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

import type { CSSProperties, FocusEvent, KeyboardEvent, PointerEvent } from 'react';
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
	const [query, setQuery] = react.useState('');
	const [menuPos, setMenuPos] = react.useState<PanelPoint | null>(null);
	const [dragRatio, setDragRatio] = react.useState<number | null>(null);
	const [failure, setFailure] = react.useState<string | null>(null);
	const [hovered, hoverHandlers] = useHover();
	// 标题区那一行模型名的 hover：它是按钮，但不给整块背景，只改文字色。
	const [modelHovered, modelHoverHandlers] = useHover();

	const rootRef = react.useRef<HTMLDivElement>(null);
	const triggerRef = react.useRef<HTMLButtonElement>(null);
	const menuRef = react.useRef<HTMLElement>(null);
	const modelButtonRef = react.useRef<HTMLButtonElement>(null);
	const searchRef = react.useRef<HTMLInputElement>(null);
	const listRef = react.useRef<HTMLDivElement>(null);
	const trackRef = react.useRef<HTMLDivElement>(null);
	const thumbRef = react.useRef<HTMLSpanElement>(null);
	const fillRef = react.useRef<HTMLSpanElement>(null);
	/** 菜单 / 列表 / aria-controls 共用的稳定 id（React 18 的 useId 含冒号，只做属性值用）。 */
	const id = react.useId();

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
	const groups = state.groups.filter((group) => group.models.length > 0);
	const failures = state.failures ?? [];
	const totalModels = groups.reduce((sum, group) => sum + group.models.length, 0);
	// 与官方一致的阈值：模型超过 4 个才显示搜索，避免小目录多一个控件。
	const showSearch = totalModels > 4;
	const normalizedQuery = query.trim().toLowerCase();
	const filteredGroups = normalizedQuery === ''
		? groups
		: groups
				.map((group) => ({
					...group,
					models: group.models.filter((model) =>
						(model.name ?? model.id).toLowerCase().includes(normalizedQuery)),
				}))
				.filter((group) => group.models.length > 0);
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
	const busy = state.pending !== null && state.pending !== undefined;
	// 触发器只在 owner 锁定时禁用；pending 期间它必须保持可聚焦，否则焦点会掉到
	// disabled 行上、面板随即因 blur 关闭（官方的 submit 也是先 focus trigger）。
	const triggerLocked = locked === true;
	const controlsLocked = triggerLocked || busy;
	const message = failure ?? state.error ?? null;

	/**
	 * 焦点工具。面板是 portal，React 事件仍冒泡到这里，但 `document.activeElement`
	 * 是真实 DOM 的焦点，必须按它判断；离线自检的假节点没有 querySelectorAll，
	 * 这里统一容错，避免自检因为缺 DOM 能力而崩。
	 */
	const activeElement = (): HTMLElement | null => {
		const active = typeof document === 'undefined' ? null : document.activeElement;
		return active !== null && typeof active === 'object' && 'focus' in active ? (active as HTMLElement) : null;
	};
	const queryAll = (root: Element | null, selector: string): HTMLElement[] => {
		if (root === null || typeof root.querySelectorAll !== 'function') return [];
		return Array.from(root.querySelectorAll<HTMLElement>(selector));
	};
	/** 触发器 + 面板里的全部可聚焦控件，顺序即 Tab 顺序。 */
	const focusables = (): HTMLElement[] => {
		const nodes: HTMLElement[] = [];
		if (triggerRef.current !== null && triggerRef.current.disabled !== true) nodes.push(triggerRef.current);
		if (menuRef.current !== null) {
			nodes.push(...queryAll(
				menuRef.current,
				'button:not([disabled]), input:not([disabled]), [role="slider"][tabindex="0"]',
			));
		}
		return nodes;
	};
	/** 模型列表里的可聚焦行（含"返回"），用于方向键/Tab 导航。 */
	const modelRows = (): HTMLElement[] => queryAll(listRef.current, 'button:not([disabled])');
	/** 只含模型行（不含"返回"）；进入面板/Home/End 优先落在这里。 */
	const modelChoices = (): HTMLElement[] => queryAll(listRef.current, '[role="menuitemradio"]:not([disabled])');

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

	// 进入模型列表时把焦点落到当前行（或第一行）；返回根面板由 backToRoot() 负责。
	react.useEffect(() => {
		if (!open || pane !== 'model') return undefined;
		if (showSearch) {
			searchRef.current?.focus();
			return undefined;
		}
		const checked = listRef.current?.querySelector<HTMLElement>(
			'[role="menuitemradio"][aria-checked="true"]:not([disabled])',
		) ?? null;
		(checked ?? modelChoices()[0] ?? modelRows()[0])?.focus();
		return undefined;
	}, [open, pane, showSearch]);

	// available === false 出现在被寻址的子代理会话上：与官方一致，什么都不渲染。
	if (!available) return null;

	// ---- 交互 ----
	const show = (): void => {
		// 鼠标点击触发器时，onMouseDown 的 preventDefault（WebKit 行内按钮保持焦点的
		// 兼容处理）会让按钮拿不到焦点；这里显式补齐。官方 ModelSelect.show() 同样先
		// focus trigger，否则 Esc / 方向键会落在 composer 里，面板等于没有键盘入口。
		triggerRef.current?.focus();
		setFailure(null);
		setDragRatio(null);
		setQuery('');
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

	/** 在"触发器 + 面板控件"之间循环移动焦点；Tab 不再把焦点漏到整个页面。 */
	const moveTab = (direction: 1 | -1): void => {
		const nodes = focusables();
		if (nodes.length === 0) return;
		const active = activeElement();
		const index = active === null ? -1 : nodes.indexOf(active);
		const next = index === -1
			? (direction > 0 ? 0 : nodes.length - 1)
			: (index + direction + nodes.length) % nodes.length;
		nodes[next]?.focus();
	};

	/** 在模型行（含"返回"）之间循环移动焦点。 */
	const moveModelFocus = (direction: 1 | -1): void => {
		const rows = modelRows();
		if (rows.length === 0) return;
		const active = activeElement();
		const index = active === null ? -1 : rows.indexOf(active);
		const next = index === -1
			? (direction > 0 ? 0 : rows.length - 1)
			: (index + direction + rows.length) % rows.length;
		rows[next]?.focus();
	};

	/** 从模型列表退回根面板，并把焦点交给"模型名"按钮。 */
	const backToRoot = (): void => {
		setPane('root');
		queueMicrotask(() => modelButtonRef.current?.focus());
	};

	/**
	 * 焦点离开"座位 + portal"时关闭面板。relatedTarget 在部分浏览器/测试环境里
	 * 会是 null，所以再在微任务里按 document.activeElement 复核一次。
	 */
	const onRootBlur = (event: FocusEvent<HTMLDivElement>): void => {
		if (!open) return;
		const next = event.relatedTarget as Node | null;
		if (next !== null && (rootRef.current?.contains(next) === true || menuRef.current?.contains(next) === true)) return;
		queueMicrotask(() => {
			const active = activeElement();
			if (active !== null && (rootRef.current?.contains(active) === true || menuRef.current?.contains(active) === true)) return;
			close();
		});
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
		if (controlsLocked || current === null || current === undefined) return;
		const level = efforts[index];
		if (level === undefined || level.id === effectiveEffort) return;
		setFailure(null);
		// pending 期间触发器保持 enabled；先把焦点放回去，面板不会因 disabled 行失焦。
		triggerRef.current?.focus();
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
		if (controlsLocked || efforts.length === 0) return;
		// 右键/中键也会派发 pointerdown；只接受主指针的左键。
		if (event.button !== 0 || event.isPrimary === false) return;
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
		if (controlsLocked) return;
		commitEffort(snapIndex(ratio === null ? dragRatio : ratio, efforts.length));
	};
	/** 系统取消 / 捕获丢失：清掉拖拽态，绝不把"取消"当成松手提交。 */
	const onPointerCancel = (): void => {
		setDragRatio(null);
	};

	/**
	 * 键盘：Tab 在"触发器 + 面板控件"内循环，Shift+Tab 逐级退出/关闭；
	 * 模型列表用上下键移动，滑杆用左右/Home/End 调档。
	 */
	const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
		if (event.nativeEvent?.isComposing === true) return;
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			if (pane !== 'root') backToRoot();
			else close(true);
			return;
		}
		const active = activeElement();
		if (event.key === 'Tab') {
			event.preventDefault();
			if (event.shiftKey) {
				if (pane !== 'root') backToRoot();
				else close(true);
				return;
			}
			if (active === searchRef.current) {
				(modelChoices()[0] ?? modelRows()[0])?.focus();
				return;
			}
			moveTab(1);
			return;
		}
		if (event.key === undefined) return;
		if (active === searchRef.current && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
			event.preventDefault();
			const choices = modelChoices();
			(event.key === 'ArrowDown' ? choices[0] : choices[choices.length - 1])?.focus();
			return;
		}
		const inList = listRef.current !== null && active !== null && listRef.current.contains(active);
		if (inList && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
			event.preventDefault();
			moveModelFocus(event.key === 'ArrowDown' ? 1 : -1);
			return;
		}
		if (inList && (event.key === 'Home' || event.key === 'End')) {
			event.preventDefault();
			const choices = modelChoices();
			choices[event.key === 'Home' ? 0 : choices.length - 1]?.focus();
			return;
		}
		if (inList) return;
		// 模型面板里焦点在"模型名"按钮上时，上下键直接进入列表。
		if (pane === 'model' && active === modelButtonRef.current && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
			event.preventDefault();
			const choices = modelChoices();
			const target = choices.length > 0
				? choices[event.key === 'ArrowDown' ? 0 : choices.length - 1]
				: modelRows()[0];
			target?.focus();
			return;
		}
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			moveTab(event.key === 'ArrowDown' ? 1 : -1);
			return;
		}
		// Home/End/左右键只在触发器或滑杆上表示"调档"，模型名按钮上不抢键。
		const onEffortControl = active === null || active === triggerRef.current || active === trackRef.current;
		if (!onEffortControl) return;
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
		if (controlsLocked) return;
		if (model.id === current?.model && group.id === current?.provider) {
			backToRoot();
			return;
		}
		setFailure(null);
		// 提交期间焦点停在触发器上；模型行会因 busy 被禁用，不能让焦点留在那里。
		triggerRef.current?.focus();
		const selection: ModelSelection = { provider: group.id, model: model.id };
		const levels = model.reasoning?.efforts ?? [];
		if (levels.length > 0) selection.reasoningEffort = levels[levels.length - 1].id;
		Promise.resolve(select(selection)).then(
			(outcome) => settle(outcome, backToRoot),
			(reason: unknown) => setFailure(String(reason)),
		);
	};

	// ---- 渲染 ----
	const triggerStyle: CSSProperties = { ...styles.trigger };
	// 打开态也上底色：否则看不出这个按钮正被按住（hover 只在悬停时给）。
	if ((hovered || open) && !triggerLocked) Object.assign(triggerStyle, styles.triggerHover);
	if (triggerLocked) Object.assign(triggerStyle, styles.triggerDisabled);

	const modelLineStyle: CSSProperties = { ...styles.headerModel };
	if (modelHovered && !controlsLocked) Object.assign(modelLineStyle, styles.headerModelHover);
	if (controlsLocked) Object.assign(modelLineStyle, styles.rowDisabled);

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
			aria-controls={open ? `${id}-menu` : undefined}
			title={`${modelLabel} · ${committedLabel ?? '默认'}`}
			aria-busy={busy}
			disabled={triggerLocked}
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
						id={`${id}-menu`}
						compact={true}
						role="dialog"
						aria-label="模型与推理等级"
						aria-busy={busy || state.status === 'loading'}
						style={{ ...styles.menu, ...(menuPos ?? styles.measure) }}
					>
						{/* 标题区（居中，参考 Codex 的档位面板）：上面是当前档位，下面是模型名 + ›。
						    模型名本身就是"下钻到模型列表"的入口——原来面板底部那一行已经并到这里。 */}
						<div style={styles.header}>
							<div style={styles.headerTitle} title={effortLabel ?? '默认'}>
								{effortLabel ?? '默认'}
							</div>
							<button
								ref={modelButtonRef}
								type="button"
								aria-label={`选择模型，当前 ${modelLabel}`}
								aria-haspopup="menu"
								aria-expanded={pane === 'model'}
								aria-controls={pane === 'model' ? `${id}-models` : undefined}
								title={modelLabel}
								disabled={controlsLocked}
								style={modelLineStyle}
								onClick={() => {
									setQuery('');
									setPane('model');
								}}
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
								locked={controlsLocked}
								onPointerDown={onPointerDown}
								onPointerMove={onPointerMove}
								onPointerUp={onPointerUp}
								onPointerCancel={onPointerCancel}
								onLostPointerCapture={onPointerCancel}
							/>
						)}

						{/* 模型列表（下钻时） */}
						{pane === 'model' ? (
							<div style={styles.list}>
								{showSearch ? (
									<input
										ref={searchRef}
										type="search"
										aria-label="搜索模型"
										aria-controls={`${id}-models`}
										placeholder="搜索模型…"
										value={query}
										onChange={(event) => setQuery(event.target.value)}
										style={styles.search}
									/>
								) : null}
								<div ref={listRef} id={`${id}-models`} role="menu" aria-label="模型列表">
									<Row role="menuitem" onClick={backToRoot}>
										<primitives.IconChevronLeftOutlineRegular size={14} style={styles.chevron} />
										<span style={styles.caption}>返回</span>
									</Row>
									{filteredGroups.map((group) => (
										<div
											key={group.id}
											role="group"
											aria-label={group.name ?? group.id}
											style={styles.group}
										>
											{/* 组名（provider）可见：用户配置的第三方路由（cpa / huawei / tengxun…）
											    与官方 provider 的模型混在同一个列表里，没有这一行就分不出"这个模型是
											    谁家的"（实测反馈）。它只是标题行，不是可选行；`role="group"` 上的
											    aria-label 已经念过同一个名字，所以视觉标题（含右侧的模型数）对读屏隐藏，
											    避免重复播报。细线与模型数是"分组"的主要视觉信号，不是装饰。 */}
											<div style={styles.groupLabel}>
												<span style={styles.groupLabelText} aria-hidden="true">
													{group.name ?? group.id}
												</span>
												<span style={styles.groupRule} aria-hidden="true" />
												<span style={styles.groupCount} aria-hidden="true">
													{String(group.models.length)}
												</span>
											</div>
											{group.models.map((model) => {
												const isCurrent = current?.provider === group.id && current?.model === model.id;
												const isPending = busy
													&& state.pending?.provider === group.id
													&& state.pending?.model === model.id;
												const levels = model.reasoning?.efforts ?? [];
												// 当前模型显示会话正在用的档位；其它模型显示**选中它会带上的那一档**
												// （= 该模型的最高档，见 chooseModel）。
												//
												// 原来这里显示路由默认档（`model.reasoning.defaultEffort`），
												// 而路由默认档是"一条路由一个值"：huawei 设成 high 之后每个模型
												// 都显示 High，看不出谁支持 max（实测反馈：「huawei 都是 high」）。
												const appliedEffort = levels.length > 0 ? levels[levels.length - 1].id : undefined;
												const effortId = isCurrent
													? (current?.reasoningEffort ?? model.reasoning?.defaultEffort ?? appliedEffort)
													: appliedEffort;
												const effortName = levels.find((level) => level.id === effortId)?.name ?? effortId;
												return (
													<Row
														key={`${group.id}/${model.id}`}
														role="menuitemradio"
														checked={isCurrent}
														disabled={controlsLocked}
														// 组名已经可见，provider 仍然留在读屏标签里：读屏按行的顺序念，
														// 不依赖"组标题被念过"这件事，同名模型来自不同 provider 也分得清。
														ariaLabel={`${model.name ?? model.id}，${group.name ?? group.id}`}
														title={levels.length === 0 ? undefined : `${String(levels.length)} 档可选`}
														onClick={() => chooseModel(group, model)}
													>
														<span style={styles.modelName}>{model.name ?? model.id}</span>
														{effortName === undefined ? null : (
															<span style={isCurrent ? styles.effortName : styles.caption}>{effortName}</span>
														)}
														<span style={styles.slot}>
															{isPending ? (
																<primitives.StateDot state="ongoing" />
															) : isCurrent ? (
																<primitives.IconCheckOutlineRegular size={14} />
															) : null}
														</span>
													</Row>
												);
											})}
										</div>
									))}
								</div>
								{filteredGroups.length === 0 && failures.length === 0 ? (
									<div style={styles.notice} role="status">
										{normalizedQuery !== ''
											? '没有匹配的模型'
											: state.status === 'loading'
												? '正在载入模型…'
												: '暂无可用模型'}
									</div>
								) : null}
								{failures.map((entry) => (
									<div key={`failure-${entry.id}`} style={styles.failureRow} role="status">
										<span style={styles.modelName}>{entry.name ?? entry.id}</span>
										<span style={styles.caption}>{entry.message}</span>
									</div>
								))}
							</div>
						) : null}

						{/* 失败提示（选择被拒时保留面板） */}
						{message === null ? null : (
							<div style={styles.error} role="status">
								<span>{message}</span>
								{failure === null && state.error !== null ? (
									<button type="button" style={styles.retry} onClick={load}>重试</button>
								) : null}
							</div>
						)}
					</primitives.MenuSurface>,
					document.body,
				);

	return (
		<div
			ref={rootRef}
			style={styles.root}
			onKeyDown={onRootKeyDown}
			onBlur={onRootBlur}
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
