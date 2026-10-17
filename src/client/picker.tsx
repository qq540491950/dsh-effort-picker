/**
 * composer 的模型座位（Codex 风格档位面板）。
 *
 * 外层 {@link CodexEffortPicker} 只做一件事：把内层包进座位自己的错误边界。内层抛错时
 * 条目依然存活（见 `boundary.tsx`），这是"遮蔽型座位一旦崩就被 DSH 退役"的唯一解药。
 *
 * 数据面只走官方按会话共享的目录服务（`ctx.modelDirectories`）：读 `store`，
 * 写 `select()`，写入只作用于**下一次请求**，因此与 `/model` 命令看到的状态天然一致。
 *
 * 面板的位置分两段（见 `placement.ts`）：打开瞬间用纯函数同步估算，
 * 打开期间用 `autoUpdate` 跟随（composer 撑高、窗口缩放、外层滚动都不再错位）。
 */

import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';
import { react, reactDom, h, primitives } from './platform';
import { SeatBoundary } from './boundary';
import { Row } from './row';
import { EffortTrack } from './track';
import { useHover } from './hooks';
import { centerAt, ratioOf, snapIndex, THUMB_INSET, THUMB_SIZE } from './geometry';
import { PANEL_GAP, PANEL_MARGIN, estimatePanelPosition } from './placement';
import { writeInlineStyle } from './dom';
import { styles } from './styles';
import type { ModelEntry, ModelGroup, ModelSelection, SelectOutcome } from './model';
import type { SeatProps } from './services';

/** 面板的两个页面：档位滑杆（根）与模型列表（下钻）。 */
type Pane = 'root' | 'model';

/** 面板的 `position: fixed` 落位。 */
interface PanelPoint {
	left: number;
	top: number;
}

/** 座位入口：错误边界 + 真正的实现。 */
export function CodexEffortPicker(props: SeatProps) {
	return (
		<SeatBoundary>
			<CodexEffortPickerSeat {...props} />
		</SeatBoundary>
	);
}

/** 座位实现：解析注入面 → 渲染触发器与面板。 */
function CodexEffortPickerSeat(props: SeatProps) {
	const { locked, resolve } = props;

	// 解析注入面。会话还没建立 retained generation 时会抛错——由外层 SeatBoundary
	// 兜住并自动重试，绝不让它冒泡到 DSH 的外层边界（那会退役整个条目）。
	const resolved = resolve();
	const available = resolved.available;
	const modelDirectory = resolved.directory;
	const directory = modelDirectory.store;

	/** 载入目录；子代理会话上什么都不做。 */
	const load = (): void => {
		if (available) void modelDirectory.load().catch(() => undefined);
	};
	/** 提交一次选择；子代理会话上短路成 undefined。 */
	const select = (selection: ModelSelection): Promise<SelectOutcome | undefined> =>
		available ? modelDirectory.select(selection) : Promise.resolve(undefined);

	// 官方同一姿势：目录本身就是一个 snapshot store。
	const state = react.useSyncExternalStore(
		(listener) => directory.subscribe(listener),
		() => directory.getSnapshot(),
	);

	const [open, setOpen] = react.useState(false);
	const [pane, setPane] = react.useState<Pane>('root');
	const [menuPos, setMenuPos] = react.useState<PanelPoint | null>(null);
	const [dragRatio, setDragRatio] = react.useState<number | null>(null);
	const [failure, setFailure] = react.useState<string | null>(null);
	const [hovered, hoverHandlers] = useHover();
	// 标题区那一行模型名的 hover：它是按钮，但不给整块背景，只改文字色。
	const [modelHovered, modelHoverHandlers] = useHover();

	const rootRef = react.useRef<HTMLDivElement>(null);
	const triggerRef = react.useRef<HTMLButtonElement>(null);
	const menuRef = react.useRef<HTMLElement>(null);
	const trackRef = react.useRef<HTMLDivElement>(null);
	const thumbRef = react.useRef<HTMLSpanElement>(null);
	const fillRef = react.useRef<HTMLSpanElement>(null);

	// ---- 派生：当前模型与它的档位集合 ----
	const current = state.current;
	const currentModel: ModelEntry | undefined =
		current === null || current === undefined
			? undefined
			: state.groups
					.find((group) => group.id === current.provider)
					?.models.find((model) => model.id === current.model);
	const reasoning = currentModel?.reasoning;
	const efforts = reasoning?.efforts ?? [];
	const effectiveEffort = current?.reasoningEffort ?? reasoning?.defaultEffort;
	const activeIndex = efforts.findIndex((level) => level.id === effectiveEffort);
	/**
	 * 轨道上画滑块头用的下标：已提交档位 → 模型默认档 → **该模型的最高档**。
	 *
	 * 为什么必须有最后那一级：只要模型有档位，轨道上就**一定**要画得出滑块头——没有滑块头的
	 * 轨道看起来就是坏的（实测反馈：「选择别的模型的时候滑块依然不行」，根因是切模型时会话档位
	 * 被清空 → `activeIndex = -1` → thumb / fill 都不渲染）。`effortDefaulted` 记下"这一格不是
	 * 用户显式选的"，触发器与面板标题补一个「（默认）」后缀，不撒谎。
	 */
	const shownIndex = activeIndex >= 0 ? activeIndex : efforts.length - 1;
	const effortDefaulted = activeIndex < 0 && shownIndex >= 0;
	/** 拖动中显示的是指针位置，静止时显示当前档位。 */
	const previewIndex = dragRatio === null ? shownIndex : snapIndex(dragRatio, efforts.length);
	const shownRatio =
		dragRatio === null ? (shownIndex >= 0 ? ratioOf(shownIndex, efforts.length) : null) : dragRatio;

	/**
	 * 面板标题用的档位名：拖动中跟随最近的停靠点（面板是唯一该跟手变化的地方）。
	 */
	const titleName = previewIndex >= 0 ? efforts[previewIndex].name : (effectiveEffort ?? '默认');
	const effortLabel =
		reasoning === undefined ? state.retainedEffort : effortDefaulted ? `${titleName}（默认）` : titleName;
	/**
	 * 已提交档位名：触发器（面板**外面**那个控件）与无障碍文案用它。
	 * 触发器必须跟着已提交档位走，不能跟拖动预览——否则在面板里拖档时，
	 * 下方那一行会在 Low/Medium/High 之间来回跳，宽度也跟着抖。
	 */
	const committedName = shownIndex >= 0 ? efforts[shownIndex].name : (effectiveEffort ?? '默认');
	const committedLabel =
		reasoning === undefined
			? state.retainedEffort
			: effortDefaulted
				? `${committedName}（默认）`
				: committedName;
	const modelLabel =
		current === null || current === undefined
			? state.status === 'loading'
				? '载入中…'
				: '选择模型'
			: (currentModel?.name ?? `${current.provider}/${current.model}`);
	const busy = state.pending !== null;
	const lockedNow = locked === true || available === false;
	const message = failure ?? state.error ?? null;

	// ---- 副作用（无条件调用，早退放最后）----
	react.useEffect(() => {
		if (!open) return undefined;
		const closeOutside = (event: MouseEvent): void => {
			const target = event.target as Node | null;
			if (rootRef.current?.contains(target) === true) return;
			if (menuRef.current?.contains(target) === true) return;
			setOpen(false);
		};
		document.addEventListener('mousedown', closeOutside);
		return () => document.removeEventListener('mousedown', closeOutside);
	}, [open]);

	react.useEffect(() => {
		if (!open) {
			setMenuPos(null);
			return undefined;
		}
		const trigger = triggerRef.current;
		const menu = menuRef.current;
		if (trigger !== null) {
			// 打开的第一帧就要有位置：异步测量之前先用纯函数算一次，免得看见"跳位"。
			setMenuPos(
				estimatePanelPosition(
					trigger.getBoundingClientRect(),
					{ width: menu?.offsetWidth ?? 0, height: menu?.offsetHeight ?? 0 },
					{ width: window.innerWidth, height: window.innerHeight },
				),
			);
		}
		if (trigger === null || menu === null) return undefined;
		// 打开期间持续跟随：优先往上开（composer 在窗口底部），放不下会翻到下方。
		const update = (): void => {
			void computePosition(trigger, menu, {
				placement: 'top-end',
				strategy: 'fixed',
				middleware: [offset(PANEL_GAP), flip({ padding: PANEL_MARGIN }), shift({ padding: PANEL_MARGIN })],
			}).then(({ x, y }) => setMenuPos({ left: x, top: y }));
		};
		return autoUpdate(trigger, menu, update);
	}, [open, pane, efforts.length]);

	// available === false 出现在被寻址的子代理会话上：与官方一致，什么都不渲染。
	if (!available) return null;

	// ---- 交互 ----
	const show = (): void => {
		setFailure(null);
		setDragRatio(null);
		setPane('root');
		setOpen(true);
		load();
	};
	const close = (restoreFocus?: boolean): void => {
		setOpen(false);
		setPane('root');
		setDragRatio(null);
		if (restoreFocus === true) queueMicrotask(() => triggerRef.current?.focus());
	};

	/** 把一个选择结果落到面板上（失败时保留面板并显示原因）。 */
	const settle = (outcome: SelectOutcome | undefined, onOk?: () => void): void => {
		if (outcome === undefined || outcome.ok === true) {
			onOk?.();
			return;
		}
		const code = outcome.error.code ?? 'unknown';
		setFailure(
			code === 'session/writer-held'
				? '另一个 DSH 实例正在写这个会话，请先退出它再重试'
				: `${code}: ${outcome.error.message ?? ''}`,
		);
	};

	/** 提交一个档位（一次手势只提交一次）。 */
	const commitEffort = (index: number): void => {
		if (lockedNow || current === null || current === undefined) return;
		const level = efforts[index];
		if (level === undefined || level.id === effectiveEffort) return;
		setFailure(null);
		Promise.resolve(select({ provider: current.provider, model: current.model, reasoningEffort: level.id })).then(
			(outcome) => settle(outcome),
			(reason: unknown) => setFailure(String(reason)),
		);
	};

	/** 指针位置 → 轨道内的连续比例（0..1）；两端正好是滑块中心能达到的极限。 */
	const ratioAt = (event: { clientX: number }): number | null => {
		const node = trackRef.current;
		if (node === null || efforts.length === 0) return null;
		const rect = node.getBoundingClientRect();
		const usable = rect.width - THUMB_SIZE;
		if (usable <= 0) return null;
		return Math.min(Math.max((event.clientX - rect.left - THUMB_INSET) / usable, 0), 1);
	};

	const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
		if (lockedNow || efforts.length === 0) return;
		const ratio = ratioAt(event);
		if (ratio === null) return;
		event.preventDefault();
		try {
			// 捕获之后，指针移出轨道也仍会把 pointermove 送到这里。
			event.currentTarget.setPointerCapture(event.pointerId);
		} catch {
			/* 捕获失败不影响点击选择 */
		}
		setDragRatio(ratio);
	};
	const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
		if (dragRatio === null) return;
		const ratio = ratioAt(event);
		if (ratio === null) return;
		// 先直接写 DOM：滑块与进度填充立刻跟手，不等 React 渲染；
		// setState 只为把"最近的档位名"同步到面板标题。
		writeInlineStyle(thumbRef.current, { left: centerAt(ratio) });
		writeInlineStyle(fillRef.current, { width: centerAt(ratio) });
		setDragRatio(ratio);
	};
	const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
		if (dragRatio === null) return;
		const ratio = ratioAt(event);
		setDragRatio(null);
		commitEffort(snapIndex(ratio === null ? dragRatio : ratio, efforts.length));
	};

	/** 键盘：焦点留在触发器上，方向键直接调档（面板是 React portal，事件仍冒泡到这里）。 */
	const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
		if (event.nativeEvent?.isComposing === true) return;
		if (event.key === 'Escape' && open) {
			event.preventDefault();
			if (pane !== 'root') setPane('root');
			else close(true);
			return;
		}
		if (!open || event.key === undefined) return;
		if (event.key === 'Home') {
			event.preventDefault();
			commitEffort(0);
			return;
		}
		if (event.key === 'End') {
			event.preventDefault();
			commitEffort(efforts.length - 1);
			return;
		}
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		const step = event.key === 'ArrowRight' ? 1 : -1;
		const from = activeIndex < 0 ? (step > 0 ? -1 : efforts.length) : activeIndex;
		commitEffort(Math.min(Math.max(from + step, 0), efforts.length - 1));
	};

	/**
	 * 选模型：带上**该模型的最高档**。
	 *
	 * 为什么既不是"路由默认档"（`model.reasoning.defaultEffort`）也不是"不带档位"：
	 * - 不带档位（模型没有默认档时的旧行为）会把会话档位**清空**，选择器随即
	 *   `activeIndex = -1` → 轨道不渲染滑块头，用户看到的就是"滑块不行"；
	 * - 路由默认档是**一条路由一个值**：huawei 设成 high 之后，连声明了 max 的
	 *   `global:deepseek-v4.1-flash` 也默认落在 high（实测反馈：「huawei 都是 high」）。
	 *
	 * 取该模型自己的最高档，两者都不再发生。**切过去之后滑块照旧可以拖到任意一档**
	 * （模型声明过的那些），这里只决定"刚切过去时落在哪一格"。
	 */
	const chooseModel = (group: ModelGroup, model: ModelEntry): void => {
		if (lockedNow) return;
		if (model.id === current?.model && group.id === current?.provider) {
			setPane('root');
			return;
		}
		setFailure(null);
		const selection: ModelSelection = { provider: group.id, model: model.id };
		const levels = model.reasoning?.efforts ?? [];
		if (levels.length > 0) selection.reasoningEffort = levels[levels.length - 1].id;
		Promise.resolve(select(selection)).then(
			(outcome) => settle(outcome, () => setPane('root')),
			(reason: unknown) => setFailure(String(reason)),
		);
	};

	// ---- 渲染 ----
	const triggerStyle: CSSProperties = { ...styles.trigger };
	// 打开态也上底色：否则看不出这个按钮正被按住（hover 只在悬停时给）。
	if ((hovered || open) && !lockedNow) Object.assign(triggerStyle, styles.triggerHover);
	if (lockedNow) Object.assign(triggerStyle, styles.triggerDisabled);

	const modelLineStyle: CSSProperties = { ...styles.headerModel };
	if (modelHovered && !lockedNow) Object.assign(modelLineStyle, styles.headerModelHover);
	if (lockedNow) Object.assign(modelLineStyle, styles.rowDisabled);

	const trigger = (
		<button
			ref={triggerRef}
			type="button"
			aria-label={
				current === null || current === undefined
					? '选择模型'
					: `选择模型和推理等级，当前 ${modelLabel}，推理等级 ${committedLabel ?? '默认'}`
			}
			aria-haspopup="dialog"
			aria-expanded={open}
			title={`${modelLabel} · ${committedLabel ?? '默认'}`}
			aria-busy={busy}
			disabled={lockedNow}
			style={triggerStyle}
			onClick={() => {
				if (open) close(true);
				else show();
			}}
			{...hoverHandlers}
		>
			<span style={styles.triggerText}>{modelLabel}</span>
			{committedLabel === undefined ? null : <span style={styles.triggerEffort}>{committedLabel}</span>}
			{busy ? (
				<primitives.StateDot state="ongoing" />
			) : (
				<primitives.IconChevronDownOutlineRegular
					style={{ ...styles.chevron, ...(open ? styles.chevronOpen : {}) }}
				/>
			)}
		</button>
	);

	const panel =
		open === false
			? null
			: reactDom.createPortal(
					<primitives.MenuSurface
						ref={menuRef}
						compact={true}
						role="dialog"
						aria-label="模型与推理等级"
						aria-busy={busy}
						style={{ ...styles.menu, ...(menuPos ?? styles.measure) }}
					>
						{/* 标题区（居中，参考 Codex 的档位面板）：上面是当前档位，下面是模型名 + ›。
						    模型名本身就是"下钻到模型列表"的入口——原来面板底部那一行已经并到这里。 */}
						<div style={styles.header}>
							<div style={styles.headerTitle} title={effortLabel ?? '默认'}>
								{effortLabel ?? '默认'}
							</div>
							<button
								type="button"
								aria-label={`选择模型，当前 ${modelLabel}`}
								aria-haspopup="menu"
								title={modelLabel}
								disabled={lockedNow}
								style={modelLineStyle}
								onClick={() => setPane('model')}
								{...modelHoverHandlers}
							>
								<span style={styles.headerModelText}>{modelLabel}</span>
								<primitives.IconChevronRightOutlineRegular size={12} />
							</button>
						</div>

						{/* 档位轨道，或"该模型无档位"的说明 */}
						{efforts.length === 0 ? (
							<div style={styles.notice}>
								{reasoning === undefined ? '该模型未提供推理等级' : '该模型暂无可选档位'}
							</div>
						) : (
							<EffortTrack
								trackRef={trackRef}
								thumbRef={thumbRef}
								fillRef={fillRef}
								efforts={efforts}
								previewIndex={previewIndex}
								shownRatio={shownRatio}
								dragging={dragRatio !== null}
								locked={lockedNow}
								onPointerDown={onPointerDown}
								onPointerMove={onPointerMove}
								onPointerUp={onPointerUp}
							/>
						)}

						{/* 模型列表（下钻时） */}
						{pane === 'model' ? (
							<div style={styles.list}>
								<Row onClick={() => setPane('root')}>
									<primitives.IconChevronLeftOutlineRegular size={14} style={styles.chevron} />
									<span style={styles.caption}>返回</span>
								</Row>
								{state.groups
									.filter((group) => group.models.length > 0)
									.map((group) => (
										<div key={group.id} style={styles.group} role="group" aria-label={group.name ?? group.id}>
											{/* provider 分组标题：官方也是按 provider 分组的 */}
											<div style={styles.groupHeading} aria-hidden="true">
												{group.name ?? group.id}
											</div>
											{group.models.map((model) => {
												const isCurrent =
													current?.provider === group.id && current?.model === model.id;
												const levels = model.reasoning?.efforts ?? [];
												// 当前模型显示会话正在用的档位；其它模型显示**选中它会带上的那一档**
												// （= 该模型的最高档，见 chooseModel）。
												//
												// 原来这里显示路由默认档（`model.reasoning.defaultEffort`），
												// 而路由默认档是"一条路由一个值"：huawei 设成 high 之后每个模型
												// 都显示 High，看不出谁支持 max（实测反馈：「huawei 都是 high」）。
												const appliedEffort =
													levels.length > 0 ? levels[levels.length - 1].id : undefined;
												const effortId = isCurrent
													? (current?.reasoningEffort ??
														model.reasoning?.defaultEffort ??
														appliedEffort)
													: appliedEffort;
												const effortName =
													levels.find((level) => level.id === effortId)?.name ?? effortId;
												return (
													<Row
														key={`${group.id}/${model.id}`}
														role="menuitemradio"
														checked={isCurrent}
														disabled={lockedNow}
														title={levels.length === 0 ? undefined : `${String(levels.length)} 档可选`}
														onClick={() => chooseModel(group, model)}
													>
														<span style={styles.slot}>
															{isCurrent ? <primitives.IconCheckOutlineRegular size={14} /> : null}
														</span>
														<span style={styles.modelName}>{model.name ?? model.id}</span>
														{effortName === undefined ? null : (
															<span style={isCurrent ? styles.effortName : styles.caption}>{effortName}</span>
														)}
													</Row>
												);
											})}
										</div>
									))}
							</div>
						) : null}

						{/* 失败提示（选择被拒时保留面板） */}
						{message === null ? null : <div style={styles.error}>{message}</div>}
					</primitives.MenuSurface>,
					document.body,
				);

	return (
		<div
			ref={rootRef}
			style={styles.root}
			onKeyDown={onRootKeyDown}
			onMouseDown={(event) => {
				if (event.target instanceof Element && event.target.closest('button') !== null) {
					event.preventDefault();
				}
			}}
		>
			{trigger}
			{panel}
		</div>
	);
}
