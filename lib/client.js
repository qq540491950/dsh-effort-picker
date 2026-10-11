/**
 * 浏览器半边（Client half）——DSH 自带的"懒 CJS"模块协议。
 *
 * 契约（见 @deepseek-ai/dsh-client-modules）：
 *   1. 这是一个普通 classic script，不是 ESM；执行时只做一件事：
 *      向 `window.__ModuleLoader__` 注册一个 factory。
 *   2. factory 在首次被 materialize 时执行，返回的 exports 就是模块导出。
 *   3. `id` 必须等于本包 package.json 的 `name`。
 *   4. `require` 只能取「平台种子模块」：react / react-dom / cordis /
 *      dsh-client-store / ui-slots / ui-primitives / ui-dockkit。
 *
 * 本插件做什么
 * ------------
 * 以 `priority: -1` 遮蔽 `conversation.input.model` 座位（官方注册在 0，
 * 规则是"priority 最低者渲染"），把官方那套「模型名 · 档位 → 竖排列表」换成
 * Codex 风格的面板：
 *
 *   ┌───────────────────────────────┐
 *   │            Medium             │   ← 当前档位（brand 色，居中）
 *   │     deepseek-v4.1-flash ›     │   ← 模型名，点击下钻模型列表
 *   │ ●━━━━━●━━━━━◉──────────────── │   ← 品牌色进度填充 + 停靠点 + 白圆钮
 *   └───────────────────────────────┘
 *
 * 只读复用官方那一个按会话共享的目录服务 `ctx.modelDirectories`，因此与
 * `/model` 命令弹窗看到的状态天然一致；写入也走同一个 `directory.select()`，
 * 只作用于下一次请求。
 *
 * 遮蔽是"叠加"而不是"替换"：官方插件仍然活着，`/model` 命令不受影响，
 * 出问题时删掉 patch 里的 insert 行即可立刻回到官方界面。
 *
 * 遮蔽的代价（踩过两次，别删这几行）
 * ----------------------------------
 * 第一条硬规则：遮蔽型座位（single/keyed/list）**条目一旦抛错就被退役**
 * （`SlotCore.reportEntryError(..., { abdicate: true })`），官方控件顶回来，要等页面
 * 重载或 bundle 重新发布才恢复。所以本插件的纪律是：**任何可能抛错的东西都不许在
 * inject 工厂里做**——解析推迟到渲染期（`resolve`），并由座位内的 {@link SeatBoundary}
 * 兜住 + 自动重试。
 *
 * 第二条（真正炸过一次的那个）：**Cordis 的 Service 方法会以"调用方上下文"求值。**
 * `modelDirectories` 是官方插件提供的服务，它的 `directoryFor()` 内部要用
 * `this.ctx.remote.session` / `this.ctx.sessions`；我们从外部调用它时，`this.ctx`
 * 重绑到**我们的**上下文，于是这些服务必须出现在 `apply` 的 `ctx.inject([...])`
 * 清单里。少了就是那句 `cannot get property "remote.session" without inject`。
 *
 * 为什么偏偏"切换会话"才炸：目录按会话缓存（`live.directories` 以 binding 为键）。
 * 老会话的目录是官方插件建的，缓存命中直接早退，轮不到我们去碰 `this.ctx`；
 * 新会话的目录要**我们**去建，于是撞上注入缺失。官方自己不会炸，因为它的
 * `inject` 清单里本来就有 `remote` / `remote.session`。
 */
window.__ModuleLoader__.load({
	id: "dsh-effort-picker",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let react = require("react");
		let reactDom = require("react-dom");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		const h = react.createElement;

		//#region 样式
		/** 面板与触发器的全部样式。刻意只用 inline style + 主题 token，不依赖构建期 CSS 管线。 */
		const styles = {
			root: { display: "contents" },
			trigger: {
				display: "flex",
				alignItems: "center",
				gap: "4px",
				minWidth: 0,
				maxWidth: "min(360px, 45cqw)",
				height: "28px",
				padding: "0 4px 0 8px",
				border: "none",
				borderRadius: "6px",
				background: "transparent",
				color: "var(--dsw-alias-label-secondary)",
				font: "inherit",
				fontSize: "13px",
				fontWeight: 400,
				lineHeight: "20px",
				cursor: "pointer",
			},
			triggerHover: { background: "var(--dsw-alias-bg-layer-2)" },
			triggerDisabled: { opacity: 0.5, cursor: "default" },
			// 紧凑模式：空间不够时 composer 会把这两个变量改成 none/block，官方选择器同样遵守。
			triggerIcon: { display: "var(--dsh-composer-model-icon-display, none)", flex: "none" },
			triggerText: {
				display: "var(--dsh-composer-model-text-display, block)",
				minWidth: 0,
				overflow: "hidden",
				whiteSpace: "nowrap",
				textOverflow: "ellipsis",
			},
			triggerEffort: {
				display: "var(--dsh-composer-model-text-display, block)",
				flexShrink: 1000,
				minWidth: 0,
				overflow: "hidden",
				whiteSpace: "nowrap",
				textOverflow: "ellipsis",
				color: "var(--dsw-alias-brand-primary)",
			},
			chevron: { flex: "none", color: "var(--dsw-alias-label-secondary)", transition: "transform .12s" },
			chevronOpen: { transform: "rotate(180deg)" },
			measure: { visibility: "hidden", left: 0, top: 0 },
			menu: {
				position: "fixed",
				zIndex: 1100,
				display: "flex",
				flexDirection: "column",
				gap: "10px",
				// 面板宽度：滑轨宽度 = 面板宽 - 左右各 12px padding。
				// 264px → 224px 后滑轨为 200px（更紧凑，代价是模型名可显示的字符数变少）。
				width: "224px",
				padding: "12px",
				color: "var(--dsw-alias-label-primary)",
				fontSize: "13px",
				lineHeight: "18px",
			},
			// 标题区（居中，参考 Codex 的档位面板）：当前档位在上，模型名在下。
			header: { display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", maxWidth: "100%" },
			headerTitle: {
				maxWidth: "100%",
				overflow: "hidden",
				whiteSpace: "nowrap",
				textOverflow: "ellipsis",
				textAlign: "center",
				color: "var(--dsw-alias-brand-primary)",
				fontSize: "14px",
				fontWeight: 500,
				lineHeight: "20px",
			},
			// 模型名那一行：居中 + › 的下钻入口。hover 只改文字色，不做背景块（参考图里它就是一行普通文字）。
			headerModel: {
				display: "inline-flex",
				alignItems: "center",
				gap: "2px",
				maxWidth: "100%",
				padding: "0 2px",
				border: "none",
				borderRadius: "4px",
				background: "transparent",
				color: "var(--dsw-alias-label-secondary)",
				font: "inherit",
				fontSize: "12px",
				lineHeight: "18px",
				cursor: "pointer",
			},
			headerModelHover: { color: "var(--dsw-alias-label-primary)" },
			headerModelText: { minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
			caption: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px" },
			group: { display: "flex", flexDirection: "column", gap: "2px" },
			groupHeading: {
				padding: "6px 8px 2px",
				color: "var(--dsw-alias-label-secondary)",
				fontSize: "11px",
				fontWeight: 500,
				letterSpacing: "0.02em",
			},
			effortName: { color: "var(--dsw-alias-brand-primary)", fontSize: "13px", fontWeight: 500 },
			track: {
				position: "relative",
				// 轨道高度与 THUMB_SIZE 是同一套比例：白色圆钮（25px）刻意比轨道（22px）大一点，
				// 会从轨道上下各探出约 1.5px——参考图里的圆钮就是这么"坐"在轨道上的。
				height: "22px",
				borderRadius: "999px",
				backgroundColor: "var(--dsw-alias-bg-layer-2)",
				boxShadow: "inset 0 0 0 1px var(--dsw-alias-border-l2), inset 0 1px 3px rgba(0, 0, 0, .28)",
				touchAction: "none",
				userSelect: "none",
			},
			trackDisabled: { opacity: 0.55 },
			// 进度填充：从左端一直铺到滑块中心，右端永远被滑块盖住（两者位置同源，不会错位）。
			// 最低档时它整段藏在滑块底下，轨道看上去是空的——与参考图的"轻度"状态一致。
			fill: {
				position: "absolute",
				top: 0,
				bottom: 0,
				left: 0,
				borderRadius: "999px",
				background: "var(--dsw-alias-brand-primary)",
				pointerEvents: "none",
			},
			tick: {
				position: "absolute",
				top: "50%",
				width: "4px",
				height: "4px",
				transform: "translate(-50%, -50%)",
				borderRadius: "50%",
				// 半透明白点：压在品牌色填充上是浅一号的点，落在深色轨道上也不刺眼——
				// 参考图里两种底色上都能看到它。
				background: "rgba(255, 255, 255, .28)",
				pointerEvents: "none",
			},
			thumb: {
				position: "absolute",
				top: "50%",
				width: "25px",
				height: "25px",
				transform: "translate(-50%, -50%)",
				borderRadius: "50%",
				background: "#fff",
				// 不描边、不留"缺口"：参考图里的圆钮就是一块纯白，压在品牌色填充和深色轨道上都分得开。
				pointerEvents: "none",
			},
			rowButton: {
				display: "flex",
				alignItems: "center",
				gap: "8px",
				width: "100%",
				padding: "6px 8px",
				border: "none",
				borderRadius: "6px",
				background: "transparent",
				color: "var(--dsw-alias-label-primary)",
				font: "inherit",
				textAlign: "left",
				cursor: "pointer",
			},
			rowHover: { background: "var(--dsw-alias-bg-layer-2)" },
			rowDisabled: { opacity: 0.5, cursor: "default" },
			list: {
				display: "flex",
				flexDirection: "column",
				gap: "6px",
				maxHeight: "min(320px, 50vh)",
				overflowY: "auto",
			},
			modelName: { flex: 1, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
			slot: { width: "16px", flex: "none", display: "inline-flex", alignItems: "center" },
			notice: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", padding: "4px 2px" },
			error: { color: "var(--dsw-alias-state-error-primary)", fontSize: "12px", padding: "4px 2px" },
			// 座位内部兜住错误时替换触发器的那一行提示（点击可重试）。
			failure: {
				display: "flex",
				alignItems: "center",
				height: "28px",
				padding: "0 8px",
				border: "none",
				borderRadius: "6px",
				background: "transparent",
				color: "var(--dsw-alias-state-error-primary)",
				font: "inherit",
				fontSize: "13px",
				cursor: "pointer",
			},
		};

		/**
		 * 滑块直径。比轨道（{@link styles}.track.height 的 22px）略大是刻意的：参考图里的白色圆钮
		 * 就是略微探出轨道上下边缘的。轨道两端的停靠点按半个滑块内缩，所以首尾档位时滑块边缘正好
		 * 与胶囊端头对齐。
		 */
		const THUMB_SIZE = 25;
		const THUMB_INSET = THUMB_SIZE / 2;

		/** 第 index 个档位在轨道上的比例位置；只有一档时居中。 */
		function ratioOf(index, count) {
			if (count <= 1) return 0.5;
			return index / (count - 1);
		}

		/** 比例 → 轨道内的中心位置：扣除一个滑块直径后按比例分布，两端正好内缩半个滑块。 */
		function centerAt(ratio) {
			return `calc(${String(THUMB_INSET)}px + (100% - ${String(THUMB_SIZE)}px) * ${String(ratio)})`;
		}

		/** 第 index 个停靠点（刻度）的中心位置。 */
		function offsetOf(index, count) {
			return centerAt(ratioOf(index, count));
		}
		//#endregion

		//#region 小组件
		/**
		 * 座位内部的错误边界——**这不是可选项**。
		 *
		 * DSH 的渲染器在座位条目**外层**还有一层边界（`SlotErrorBoundary`），而对
		 * single / keyed / list 这类"遮蔽型"座位，外层边界一旦捕获错误就调用
		 * `reportEntryError(..., { abdicate: true })` **把整个条目退役**：控件从界面上
		 * 彻底消失，官方控件顶上来，而且要等页面重新加载（或 bundle 被重新发布）才会
		 * 回来。座位内部先兜住，条目就永远不会被退役——失败降级成一行可点击重试的提示，
		 * 下一次渲染还有机会自愈。
		 */
		class SeatBoundary extends react.Component {
			/** @param props - `children` 就是座位子树。 */
			constructor(props) {
				super(props);
				this.state = { failure: null };
				this.timer = null;
				this.retries = 0;
				this.retry = this.retry.bind(this);
			}

			/** React 边界协议：把抛出的错误转成状态。 */
			static getDerivedStateFromError(error) {
				return { failure: error };
			}

			/**
			 * 记录真实错误，并安排一次自动重试。
			 *
			 * 绝大多数原因是**瞬时**的（目录服务刚好像尚未就绪），所以先自动重试几次；
			 * 重试耗尽还失败就停在提示上，等用户点击。控制台只在第一次失败时打一条，
			 * 否则重试会把控制台刷屏。
			 * @param error - 子树抛出的错误。
			 */
			componentDidCatch(error) {
				const detail =
					error instanceof Error
						? `${error.name}: ${error.message}\n${error.stack ?? ""}`
						: String(error);
				if (this.retries === 0) console.error("[dsh-effort-picker] 座位渲染失败：", error);
				// 留一份落盘的记录：出问题时不必开 DevTools 也能读到原因。
				try {
					window.localStorage.setItem(
						"dsh-effort-picker:last-failure",
						`${new Date().toISOString()}\n${detail}`,
					);
				} catch {
					/* 存储不可用时只剩控制台 */
				}
				if (this.retries < 12) {
					this.retries += 1;
					this.timer = setTimeout(this.retry, 150);
				}
			}

			/** 卸载时清掉待重试的定时器。 */
			componentWillUnmount() {
				if (this.timer !== null) clearTimeout(this.timer);
			}

			/** 清掉失败态：子树重新挂载，也就是再解析一次注入面。 */
			retry() {
				if (this.timer !== null) {
					clearTimeout(this.timer);
					this.timer = null;
				}
				this.setState({ failure: null });
			}

			/** 正常时渲染子树；失败时渲染一行提示。 */
			render() {
				if (this.state.failure === null) return this.props.children;
				const failure = this.state.failure;
				const message = failure instanceof Error ? `${failure.name}: ${failure.message}` : String(failure);
				return h(
					"button",
					{
						type: "button",
						style: styles.failure,
						title: message,
						onClick: this.retry,
					},
					"推理等级控件异常，点击重试",
				);
			}
		}

		/** 悬停态（inline style 拿不到 :hover，只能自己记）。 */
		function useHover() {
			const [hovered, setHovered] = react.useState(false);
			return [
				hovered,
				{
					onMouseEnter: () => setHovered(true),
					onMouseLeave: () => setHovered(false),
				},
			];
		}

		/** 面板里的一个可点行。 */
		function Row(props) {
			const [hovered, hoverHandlers] = useHover();
			const style = { ...styles.rowButton };
			if (hovered && props.disabled !== true) Object.assign(style, styles.rowHover);
			if (props.disabled === true) Object.assign(style, styles.rowDisabled);
			return h(
				"button",
				{
					type: "button",
					role: props.role,
					"aria-checked": props.checked,
					title: props.title,
					style,
					disabled: props.disabled === true,
					onClick: props.onClick,
					...hoverHandlers,
				},
				props.children,
			);
		}

		/**
		 * 档位轨道：品牌色进度填充 + 离散停靠点 + 连续跟手的白色滑块。
		 * @param props - efforts / activeIndex / shownRatio / dragging / locked / 指针回调 / trackRef、thumbRef、fillRef。
		 */
		function EffortTrack(props) {
			const count = props.efforts.length;
			const ticks = [];
			for (let index = 0; index < count; index += 1) {
				ticks.push(
					h("span", {
						key: `tick-${props.efforts[index].id}`,
						style: { ...styles.tick, left: offsetOf(index, count) },
					}),
				);
			}
			// 拖动时滑块与填充都按连续比例跟手，静止时停在当前档位；
			// 拖动中必须关掉 transition，否则动画会拖在手速后面。
			const thumb =
				props.shownRatio === null
					? null
					: h("span", {
							ref: props.thumbRef,
							style: {
								...styles.thumb,
								left: centerAt(props.shownRatio),
								transition: props.dragging === true ? "none" : "left .12s ease-out",
							},
						});
			// 进度填充：宽度 = 滑块中心距轨道左端的距离。右端永远被滑块盖住，
			// 所以两者只要用同一个 centerAt(ratio) 就不会错位。
			const fill =
				props.shownRatio === null
					? null
					: h("span", {
							ref: props.fillRef,
							style: {
								...styles.fill,
								width: centerAt(props.shownRatio),
								transition: props.dragging === true ? "none" : "width .12s ease-out",
							},
						});
			return h(
				"div",
				{
					ref: props.trackRef,
					role: "slider",
					tabIndex: props.locked ? -1 : 0,
					"aria-label": "推理等级",
					"aria-valuemin": 1,
					"aria-valuemax": count,
					"aria-valuenow": props.previewIndex >= 0 ? props.previewIndex + 1 : undefined,
					"aria-valuetext": props.previewIndex >= 0 ? props.efforts[props.previewIndex].name : "未设置",
					style: {
						...styles.track,
						...(props.locked ? styles.trackDisabled : {}),
						cursor: props.locked ? "default" : props.dragging === true ? "grabbing" : "pointer",
					},
					onPointerDown: props.onPointerDown,
					onPointerMove: props.onPointerMove,
					onPointerUp: props.onPointerUp,
					onPointerCancel: props.onPointerUp,
				},
				fill,
				ticks,
				thumb,
			);
		}
		//#endregion

		//#region 座位组件
		/**
		 * composer 的模型座位（Codex 风格）。
		 *
		 * 外层只做一件事：把内层包进座位自己的错误边界。内层抛错时条目依然存活
		 * （见 {@link SeatBoundary}），这是"遮蔽型座位一旦崩就被 DSH 退役"的唯一解药。
		 * @param props - owner 份额（locked）+ 注入面（resolve）。
		 */
		function CodexEffortPicker(props) {
			return h(SeatBoundary, null, h(CodexEffortPickerSeat, props));
		}

		/**
		 * 座位内层：解析注入面 → 渲染触发器与面板。
		 * @param props - owner 份额（locked）+ 注入面（resolve）。
		 */
		function CodexEffortPickerSeat(props) {
			const { locked, resolve } = props;

			// 解析注入面。会话还没建立 retained generation 时会抛错——由外层 SeatBoundary
			// 兜住并自动重试，绝不让它冒泡到 DSH 的外层边界（那会退役整个条目）。
			const resolved = resolve();
			const available = resolved.available;
			const modelDirectory = resolved.directory;
			const directory = modelDirectory.store;
			/** 载入目录；子代理会话上什么都不做。 */
			const load = () => {
				if (available) modelDirectory.load().catch(() => {});
			};
			/** 提交一次选择；子代理会话上短路成 undefined。 */
			const select = (selection) =>
				available ? modelDirectory.select(selection) : Promise.resolve(undefined);

			// 官方同一姿势：目录本身就是一个 snapshot store。
			const state = react.useSyncExternalStore(
				(listener) => directory.subscribe(listener),
				() => directory.getSnapshot(),
			);

			const [open, setOpen] = react.useState(false);
			const [pane, setPane] = react.useState("root");
			const [menuPos, setMenuPos] = react.useState(null);
			const [dragRatio, setDragRatio] = react.useState(null);
			const [failure, setFailure] = react.useState(null);
			const [hovered, hoverHandlers] = useHover();
			// 标题区那一行模型名的 hover：它是按钮，但不给整块背景，只改文字色。
			const [modelHovered, modelHoverHandlers] = useHover();

			const rootRef = react.useRef(null);
			const triggerRef = react.useRef(null);
			const menuRef = react.useRef(null);
			const trackRef = react.useRef(null);
			const thumbRef = react.useRef(null);
			const fillRef = react.useRef(null);

			// ---- 派生：当前模型与它的档位集合 ----
			const current = state.current;
			const currentModel =
				current === null || current === undefined
					? undefined
					: state.groups
							.find((group) => group.id === current.provider)
							?.models.find((model) => model.id === current.model);
			const reasoning = currentModel?.reasoning;
			const efforts = reasoning?.efforts ?? [];
			const effectiveEffort = current?.reasoningEffort ?? reasoning?.defaultEffort;
			const activeIndex = efforts.findIndex((level) => level.id === effectiveEffort);
			/** 连续比例 → 最近的档位下标。 */
			const nearestIndex = (ratio) =>
				efforts.length <= 1
					? 0
					: Math.min(Math.max(Math.round(ratio * (efforts.length - 1)), 0), efforts.length - 1);
			/** 拖动中显示的是指针位置，静止时显示当前档位。 */
			const previewIndex = dragRatio === null ? activeIndex : nearestIndex(dragRatio);
			const shownRatio =
				dragRatio === null ? (activeIndex >= 0 ? ratioOf(activeIndex, efforts.length) : null) : dragRatio;
			const effortLabel =
				reasoning === undefined
					? state.retainedEffort
					: previewIndex >= 0
						? efforts[previewIndex].name
						: (effectiveEffort ?? "默认");
			const modelLabel =
				current === null || current === undefined
					? state.status === "loading"
						? "载入中…"
						: "选择模型"
					: (currentModel?.name ?? `${current.provider}/${current.model}`);
			const busy = state.pending !== null;
			const lockedNow = locked === true || available === false;
			const message = failure ?? state.error ?? null;

			// ---- 副作用（无条件调用，早退放最后）----
			react.useEffect(() => {
				if (!open) return undefined;
				const closeOutside = (event) => {
					if (rootRef.current?.contains(event.target) === true) return;
					if (menuRef.current?.contains(event.target) === true) return;
					setOpen(false);
				};
				document.addEventListener("mousedown", closeOutside);
				return () => document.removeEventListener("mousedown", closeOutside);
			}, [open]);

			react.useEffect(() => {
				if (!open) {
					setMenuPos(null);
					return undefined;
				}
				const place = () => {
					const rect = triggerRef.current?.getBoundingClientRect();
					if (rect === undefined) return;
					const margin = 12;
					const width = menuRef.current?.offsetWidth ?? 0;
					const height = menuRef.current?.offsetHeight ?? 0;
					let left = rect.right - width;
					let top = rect.top - 8 - height;
					if (width > 0) left = Math.min(Math.max(left, margin), window.innerWidth - width - margin);
					if (height > 0) top = Math.min(Math.max(top, margin), window.innerHeight - height - margin);
					setMenuPos({ left, top });
				};
				place();
				window.addEventListener("scroll", place, true);
				window.addEventListener("resize", place);
				return () => {
					window.removeEventListener("scroll", place, true);
					window.removeEventListener("resize", place);
				};
			}, [open, pane, state, efforts.length]);

			// available === false 出现在被寻址的子代理会话上：与官方一致，什么都不渲染。
			if (!available) return null;

			// ---- 交互 ----
			const show = () => {
				setFailure(null);
				setDragRatio(null);
				setPane("root");
				setOpen(true);
				load();
			};
			const close = (restoreFocus) => {
				setOpen(false);
				setPane("root");
				setDragRatio(null);
				if (restoreFocus === true) queueMicrotask(() => triggerRef.current?.focus());
			};

			/** 把一个选择结果落到面板上（失败时保留面板并显示原因）。 */
			const settle = (outcome, onOk) => {
				if (outcome === undefined || outcome.ok === true) {
					if (onOk !== undefined) onOk();
					return;
				}
				const code = outcome.error?.code ?? "unknown";
				setFailure(
					code === "session/writer-held"
						? "另一个 DSH 实例正在写这个会话，请先退出它再重试"
						: `${code}: ${outcome.error?.message ?? ""}`,
				);
			};

			/** 提交一个档位（一次手势只提交一次）。 */
			const commitEffort = (index) => {
				if (lockedNow || current === null || current === undefined) return;
				const level = efforts[index];
				if (level === undefined || level.id === effectiveEffort) return;
				setFailure(null);
				Promise.resolve(
					select({ provider: current.provider, model: current.model, reasoningEffort: level.id }),
				).then(
					(outcome) => settle(outcome),
					(reason) => setFailure(String(reason)),
				);
			};

			/** 指针位置 → 轨道内的连续比例（0..1）；两端正好是滑块中心能达到的极限。 */
			const ratioAt = (event) => {
				const node = trackRef.current;
				if (node === null || efforts.length === 0) return null;
				const rect = node.getBoundingClientRect();
				const usable = rect.width - THUMB_SIZE;
				if (usable <= 0) return null;
				return Math.min(Math.max((event.clientX - rect.left - THUMB_INSET) / usable, 0), 1);
			};

			const onPointerDown = (event) => {
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
			const onPointerMove = (event) => {
				if (dragRatio === null) return;
				const ratio = ratioAt(event);
				if (ratio === null) return;
				// 先直接写 DOM：滑块与进度填充立刻跟手，不等 React 渲染；
				// setState 只为把"最近的档位名"同步到面板标题。
				const thumb = thumbRef.current;
				if (thumb !== null && thumb.style !== undefined) thumb.style.left = centerAt(ratio);
				const fill = fillRef.current;
				if (fill !== null && fill.style !== undefined) fill.style.width = centerAt(ratio);
				setDragRatio(ratio);
			};
			const onPointerUp = (event) => {
				if (dragRatio === null) return;
				const ratio = ratioAt(event);
				setDragRatio(null);
				commitEffort(nearestIndex(ratio === null ? dragRatio : ratio));
			};

			/** 键盘：焦点留在触发器上，方向键直接调档（面板是 React portal，事件仍冒泡到这里）。 */
			const onRootKeyDown = (event) => {
				if (event.nativeEvent?.isComposing === true) return;
				if (event.key === "Escape" && open) {
					event.preventDefault();
					if (pane !== "root") setPane("root");
					else close(true);
					return;
				}
				if (!open || event.key === undefined) return;
				if (event.key === "Home") {
					event.preventDefault();
					commitEffort(0);
					return;
				}
				if (event.key === "End") {
					event.preventDefault();
					commitEffort(efforts.length - 1);
					return;
				}
				if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
				event.preventDefault();
				const step = event.key === "ArrowRight" ? 1 : -1;
				const from = activeIndex < 0 ? (step > 0 ? -1 : efforts.length) : activeIndex;
				commitEffort(Math.min(Math.max(from + step, 0), efforts.length - 1));
			};

			/** 选模型：与官方一致，带上该模型的默认档位。 */
			const chooseModel = (group, model) => {
				if (lockedNow) return;
				if (model.id === current?.model && group.id === current?.provider) {
					setPane("root");
					return;
				}
				setFailure(null);
				const selection = { provider: group.id, model: model.id };
				if (model.reasoning?.defaultEffort !== undefined) {
					selection.reasoningEffort = model.reasoning.defaultEffort;
				}
				Promise.resolve(select(selection)).then(
					(outcome) => settle(outcome, () => setPane("root")),
					(reason) => setFailure(String(reason)),
				);
			};

			// ---- 渲染 ----
			const triggerStyle = { ...styles.trigger };
			if (hovered && !lockedNow) Object.assign(triggerStyle, styles.triggerHover);
			if (lockedNow) Object.assign(triggerStyle, styles.triggerDisabled);

			const modelLineStyle = { ...styles.headerModel };
			if (modelHovered && !lockedNow) Object.assign(modelLineStyle, styles.headerModelHover);
			if (lockedNow) Object.assign(modelLineStyle, styles.rowDisabled);

			const trigger = h(
				"button",
				{
					ref: triggerRef,
					type: "button",
					"aria-label":
						current === null || current === undefined
							? "选择模型"
							: `选择模型和推理等级，当前 ${modelLabel}，推理等级 ${effortLabel ?? "默认"}`,
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					title: `${modelLabel} · ${effortLabel ?? "默认"}`,
					"aria-busy": busy,
					disabled: lockedNow,
					style: triggerStyle,
					onClick: () => (open ? close(true) : show()),
					...hoverHandlers,
				},
				h(primitives.IconDataOutlineRegular, { size: 16, style: styles.triggerIcon }),
				h("span", { style: styles.triggerText }, modelLabel),
				effortLabel === undefined ? null : h("span", { style: styles.triggerEffort }, effortLabel),
				busy
					? h(primitives.StateDot, { state: "ongoing" })
					: h(primitives.IconChevronDownOutlineRegular, {
							style: { ...styles.chevron, ...(open ? styles.chevronOpen : {}) },
						}),
			);

			const panel =
				open === false
					? null
					: reactDom.createPortal(
							h(
								primitives.MenuSurface,
								{
									ref: menuRef,
									compact: true,
									role: "dialog",
									"aria-label": "模型与推理等级",
									"aria-busy": busy,
									style: { ...styles.menu, ...(menuPos ?? styles.measure) },
								},
								// 标题区（居中，参考 Codex 的档位面板）：上面是当前档位，下面是模型名 + ›。
								// 模型名本身就是"下钻到模型列表"的入口——原来面板底部那一行已经并到这里。
								h(
									"div",
									{ style: styles.header },
									h(
										"div",
										{ style: styles.headerTitle, title: effortLabel ?? "默认" },
										effortLabel ?? "默认",
									),
									h(
										"button",
										{
											type: "button",
											"aria-label": `选择模型，当前 ${modelLabel}`,
											"aria-haspopup": "menu",
											title: modelLabel,
											disabled: lockedNow,
											style: modelLineStyle,
											onClick: () => setPane("model"),
											...modelHoverHandlers,
										},
										h("span", { style: styles.headerModelText }, modelLabel),
										h(primitives.IconChevronRightOutlineRegular, { size: 12 }),
									),
								),
								// 档位轨道，或"该模型无档位"的说明
								efforts.length === 0
									? h(
											"div",
											{ style: styles.notice },
											reasoning === undefined ? "该模型未提供推理等级" : "该模型暂无可选档位",
										)
									: h(EffortTrack, {
											trackRef,
											thumbRef,
											fillRef,
											efforts,
											activeIndex,
											previewIndex,
											shownRatio,
											dragging: dragRatio !== null,
											locked: lockedNow,
											onPointerDown,
											onPointerMove,
											onPointerUp,
										}),
								// 模型列表（下钻时）
								pane === "model"
									? h(
											"div",
											{ style: styles.list },
											h(
												Row,
												{ onClick: () => setPane("root") },
												h(primitives.IconChevronLeftOutlineRegular, { size: 14, style: styles.chevron }),
												h("span", { style: styles.caption }, "返回"),
											),
											state.groups
												.filter((group) => group.models.length > 0)
												.map((group) =>
													h(
														"div",
														{ key: group.id, style: styles.group },
														// provider 分组标题：官方也是按 provider 分组的
														h("div", { style: styles.groupHeading }, group.name ?? group.id),
														group.models.map((model) => {
															const isCurrent =
																current?.provider === group.id && current?.model === model.id;
															const levels = model.reasoning?.efforts ?? [];
															// 当前模型显示会话正在用的档位；其它模型显示它的默认档位
															// （也就是选中后会生效的那一档）。
															const effortId = isCurrent
																? (current.reasoningEffort ?? model.reasoning?.defaultEffort)
																: model.reasoning?.defaultEffort;
															const effortName =
																levels.find((level) => level.id === effortId)?.name ?? effortId;
															return h(
																Row,
																{
																	key: `${group.id}/${model.id}`,
																	role: "menuitemradio",
																	checked: isCurrent,
																	disabled: lockedNow,
																	title:
																		levels.length === 0
																			? undefined
																			: `${String(levels.length)} 档可选`,
																	onClick: () => chooseModel(group, model),
																},
																h(
																	"span",
																	{ style: styles.slot },
																	isCurrent
																		? h(primitives.IconCheckOutlineRegular, { size: 14 })
																		: null,
																),
																h("span", { style: styles.modelName }, model.name ?? model.id),
																effortName === undefined
																	? null
																	: h(
																			"span",
																			{ style: isCurrent ? styles.effortName : styles.caption },
																			effortName,
																		),
															);
														}),
													),
												),
										)
									: null,
								// 失败提示（选择被拒时保留面板）
								message === null ? null : h("div", { style: styles.error }, message),
							),
							document.body,
						);

			return h(
				"div",
				{
					ref: rootRef,
					style: styles.root,
					onKeyDown: onRootKeyDown,
					onMouseDown: (event) => {
						if (event.target instanceof Element && event.target.closest("button") !== null) {
							event.preventDefault();
						}
					},
				},
				trigger,
				panel,
			);
		}
		//#endregion

		//#region 插件体
		/**
		 * 客户端插件体：以 priority -1 遮蔽官方的 conversation.input.model 座位。
		 * @param ctx - 客户端根上下文。
		 */
		function apply(ctx) {
			// 注入清单必须覆盖**官方代码经由 `this.ctx` 碰到的每一项服务**。
			//
			// Cordis 的 Service 方法被外部插件调用时，`this.ctx` 会重绑到**调用方**的上下文。
			// `modelDirectories.directoryFor()` 内部要 `this.ctx.remote.session`，
			// 所以 "remote" / "remote.session" 必须写进我们的清单；"sessions" 同理
			// （注入面里的 `sessions.subagentAddress` 也要用）。缺任何一项，只要该会话的
			// 目录还没被官方插件建过（缓存未命中），就会抛
			// `cannot get property "remote.session" without inject`。
			ctx.inject(["slots", "modelDirectories", "sessions", "remote", "remote.session"], (scope) => {
				const models = scope.modelDirectories;
				const sessions = scope.sessions;
				scope.slots.inject("conversation.input.model", () =>
					scope.slots.register(
						{
							name: "conversation.input.model",
							// 官方注册在 priority 0；single 座位取"priority 最低者渲染"，
							// 所以 -1 就能接管渲染，而官方插件与它的 /model 命令完全不受影响。
							priority: -1,
							// 只交出**解析闭包**，绝不在这里解析。
							//
							// 理由有两条：
							// 1. inject 工厂抛错会撞上遮蔽规则（见文件头"遮蔽的代价"），条目被退役；
							// 2. 解析本身就是"可能失败"的动作——会话的目录服务按需创建，
							//    官方 directoryFor() 对没有 retained generation 的会话是 fail loud。
							// 推迟到渲染期，由座位内的 SeatBoundary 兜住并自动重试。
							inject: (sessionId) => ({
								resolve: () => {
									const directory = models.directoryFor(sessionId);
									return {
										available: sessions.subagentAddress(sessionId) === undefined,
										directory,
									};
								},
							}),
						},
						CodexEffortPicker,
					),
				);
			});
		}

		exports.apply = apply;
		return module.exports;
	},
});
