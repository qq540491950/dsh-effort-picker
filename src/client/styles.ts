/**
 * 面板与触发器的全部样式。
 *
 * 刻意只用 inline style + 主题 token：DSH 没有给插件准备构建期 CSS 管线，运行时注入
 * `<style>` 又要赌页面生命周期（座位会被反复挂载/退役）。inline style 是最省失败面的做法，
 * 代价是拿不到 `:hover` 之类的伪类——需要的那几处用状态自己记。
 *
 * 几个数值是**联动**的，改一个就得改另一个（AGENTS.md 第 3 节有台账）：
 *   · `THUMB_SIZE = 25` ↔ `thumb.width/height` 的 `25px` ↔ `track.height` 的 `22px`；
 *   · `menu.width` 的 224px ↔ 轨道实际宽度（撑满内容宽 = 面板宽 − 左右各 12px padding）。
 */

import type { CSSProperties } from 'react';

/** 全部样式。用 `satisfies` 保留字面量类型，同时逐项检查 CSS 属性名/取值。 */
export const styles = {
	root: { display: 'contents' },
	trigger: {
		display: 'flex',
		alignItems: 'center',
		gap: '6px',
		minWidth: 0,
		maxWidth: 'min(360px, 45cqw)',
		height: '28px',
		padding: '0 4px 0 8px',
		border: 'none',
		borderRadius: '6px',
		background: 'transparent',
		color: 'var(--dsw-alias-label-secondary)',
		font: 'inherit',
		fontSize: '13px',
		fontWeight: 400,
		lineHeight: '20px',
		cursor: 'pointer',
		// 悬停/按下是同一套底色，补一个过渡，避免鼠标扫过时整块闪。
		transition: 'background .12s ease, color .12s ease',
	},
	/** hover 与"面板已打开"共用（打开态也有底色，否则看不出它被按住了）。 */
	triggerHover: { background: 'var(--dsw-alias-bg-layer-2)' },
	triggerDisabled: { opacity: 0.5, cursor: 'default' },
	// 紧凑模式：空间不够时 composer 给座位设 `--dsh-composer-model-text-display: none`。
	// 官方选择器这时只剩一枚前导图标（该变量我们已不再使用，图标按反馈去掉了），
	// 我们改成**始终保留档位**——否则这一格只剩一个 chevron，看起来像坏了。
	triggerText: {
		display: 'var(--dsh-composer-model-text-display, block)',
		minWidth: 0,
		overflow: 'hidden',
		whiteSpace: 'nowrap',
		textOverflow: 'ellipsis',
	},
	triggerEffort: {
		flexShrink: 1000,
		minWidth: 0,
		overflow: 'hidden',
		whiteSpace: 'nowrap',
		textOverflow: 'ellipsis',
		// 档位比模型名浅一号：模型名继承触发器的 label-secondary，档位用 label-caption
		// （浅色主题 #adb2b8 / 深色主题 #81858c，官方插件的 triggerEffort 也是这个 token），
		// 这样"模型名 · 档位"在折叠态就分得出主次——原来档位是 brand 色，比模型名还抢眼。
		color: 'var(--dsw-alias-label-caption)',
	},
	chevron: { flex: 'none', color: 'var(--dsw-alias-label-secondary)', transition: 'transform .12s' },
	chevronOpen: { transform: 'rotate(180deg)' },
	measure: { visibility: 'hidden', left: 0, top: 0 },
	menu: {
		position: 'fixed',
		zIndex: 1100,
		display: 'flex',
		flexDirection: 'column',
		gap: '12px',
		// 面板宽度：滑轨宽度 = 面板宽 - 左右各 12px padding。
		// 264px → 224px 后滑轨为 200px（更紧凑，代价是模型名可显示的字符数变少）。
		width: '224px',
		padding: '12px',
		color: 'var(--dsw-alias-label-primary)',
		fontSize: '13px',
		lineHeight: '18px',
	},
	// 标题区（居中，参考 Codex 的档位面板）：当前档位在上，模型名在下。
	header: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', maxWidth: '100%' },
	// 档位名是面板的主角：比模型名大一号、加一点字重，但它只负责"读"，不抢滑杆的戏。
	headerTitle: {
		maxWidth: '100%',
		overflow: 'hidden',
		whiteSpace: 'nowrap',
		textOverflow: 'ellipsis',
		textAlign: 'center',
		color: 'var(--dsw-alias-brand-primary)',
		fontSize: '15px',
		fontWeight: 600,
		letterSpacing: '0.01em',
		lineHeight: '20px',
	},
	// 模型名那一行：居中 + › 的下钻入口。hover 只改文字色，不做背景块（参考图里它就是一行普通文字）。
	headerModel: {
		display: 'inline-flex',
		alignItems: 'center',
		gap: '2px',
		maxWidth: '100%',
		padding: '0 2px',
		border: 'none',
		borderRadius: '4px',
		background: 'transparent',
		color: 'var(--dsw-alias-label-secondary)',
		font: 'inherit',
		fontSize: '12px',
		lineHeight: '18px',
		cursor: 'pointer',
	},
	headerModelHover: { color: 'var(--dsw-alias-label-primary)' },
	headerModelText: { minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
	caption: { color: 'var(--dsw-alias-label-secondary)', fontSize: '12px' },
	track: {
		position: 'relative',
		// 轨道高度与 THUMB_SIZE 是同一套比例，数值来自参考图（Codex 的档位面板）：
		// 面板 310px 宽时轨道 30px、圆钮 34.5px（占面板宽的 9.7% / 11.1%）；本面板 224px
		// 等比换算就是 22px / 25px，比值 1.14:1，圆钮上下各探出 1.5px。
		// 改这里就要同步看 THUMB_SIZE（见 AGENTS.md 第 3 节）。
		height: '22px',
		borderRadius: '999px',
		// 形状不能只靠 border-radius：实测在 DSH 的 popover 里，我们写的 999px / 50%
		// 会被渲染成约 8px 的圆角（轨道两端成了圆角矩形、圆钮成了圆角方块）。
		// 轨道这里**不能**用 clip-path 兜底——clip-path 会连子节点一起裁，滑块（25px）
		// 上下探出轨道的那 1.5px 会被切平。轨道的兜底交给 `index.ts` 注入的那条
		// `[data-dsh-effort-picker-track]{border-radius:999px!important}`（!important 赢过
		// 任何普通声明，而且不裁子树）。填充/停靠点/滑块内部没有别的东西，直接用 clip-path。
		// 轨道底色不能直接用 bg-layer-2：菜单面是半透明材质（深色主题 #43454a73、
		// 浅色主题 #f8f9fa94），换算出来的面板色跟 bg-layer-2 几乎一样（浅色主题里
		// 两者都是接近白的），轨道会整条"糊"进面板里，看不出滑轨有多长。
		// 掺一档 label-primary（深色主题里是近白、浅色主题里是近黑）就永远比面板
		// 亮/暗一档，两种主题下轨道边界都清清楚楚。
		backgroundColor: 'color-mix(in srgb, var(--dsw-alias-label-primary) 10%, var(--dsw-alias-bg-layer-2))',
		boxShadow: 'inset 0 0 0 1px var(--dsw-alias-border-l2), inset 0 1px 3px rgba(0, 0, 0, .28)',
		touchAction: 'none',
		userSelect: 'none',
	},
	trackDisabled: { opacity: 0.55 },
	// 进度填充：从左端一直铺到滑块中心，右端永远被滑块盖住（两者位置同源，不会错位）。
	// 最低档时它整段藏在滑块底下，轨道看上去是空的——与参考图的"轻度"状态一致。
	fill: {
		position: 'absolute',
		top: 0,
		bottom: 0,
		left: 0,
		borderRadius: '999px',
		// 同轨道：右端必须是半圆，靠 clip-path 兜住（见 styles.track 的说明）。
		clipPath: 'inset(0 round 999px)',
		// 参考图取色：整条轨道是一块**平**的浅蓝——实测 #88c0d0（136/192/208），横向、纵向
		// 都没有渐变，也没有顶部高光和描边。早先那版「brand 55%→100% 渐变 + 白高光」是照着
		// 另一张图猜的，在这张参考图上并不存在，于是改回纯色块。
		// 这是个固定色值（不掺 token）：参考图给的就是这个色，浅色主题下同样是一块浅蓝，
		// 与浅灰轨道仍有色相差，看得见。想跟随主题品牌色就换成
		// `color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, #fff)`，代价是色相随主题漂。
		background: '#88c0d0',
		pointerEvents: 'none',
	},
	tick: {
		position: 'absolute',
		top: '50%',
		width: '4px',
		height: '4px',
		transform: 'translate(-50%, -50%)',
		borderRadius: '50%',
		// 形状靠 clip-path 兜底：宿主的 8px 圆角规则会把 4px 的点压成方块。
		clipPath: 'circle(50%)',
		// 参考图里停靠点是"比填充只亮一点点的小白点"：实测 白 28.6% 叠在 #88c0d0 上得
		// 170/210/221，直径约 5px（相对 289px 轨道 1.7%，本轨道 200px → 4px）。
		// 颜色不用裸白，而是「白与 label-primary 混 62%」再降到 34% 透明：
		//   · 深色主题 label-primary 近白 → 落在浅蓝填充上几乎只剩一点点亮（与参考图一致）；
		//   · 浅色主题 label-primary 近黑 → 白点变成浅灰点，压在浅灰轨道上仍看得见。
		// 裸 rgba(255,255,255,.3) 在浅色主题里会彻底消失，这是实测踩过的坑。
		background: 'color-mix(in srgb, color-mix(in srgb, #fff 62%, var(--dsw-alias-label-primary)) 34%, transparent)',
		// 不再描边：掺了 label-primary 之后浅色主题里它自己就是个浅灰点，不需要再勾边界；
		// 加一圈 1px 黑描边在浅蓝填充上会变成"灰圈里套亮点"，参考图里并没有这个圈。
		pointerEvents: 'none',
	},
	thumb: {
		position: 'absolute',
		top: '50%',
		width: '25px',
		height: '25px',
		transform: 'translate(-50%, -50%)',
		borderRadius: '50%',
		// 同上：圆钮必须是正圆，clip-path 说了算（宿主的 8px 圆角会把它变成圆角方块）。
		clipPath: 'circle(50%)',
		background: '#fff',
		// clip-path 会把**外侧**投影一起裁掉，所以边界改成 inset 描边（画在球内侧，裁不掉）：
		// 浅色主题下白球压浅轨时仍看得出边，深色主题下几乎不可见（与参考图一致）。
		boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, .10)',
		pointerEvents: 'none',
	},
	/** 拖动中的圆钮：只把内侧描边加深一点（`track.tsx` 按 `dragging` 切），不做光晕。 */
	thumbActive: { boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, .18)' },
	// 一个 provider 分组：一条通栏分节条 + 该 provider 的模型行。
	// **组容器本身仍然不是卡片**——没有底色、边框、圆角；底色只出现在 groupHead 这条
	// 通栏色带上（左右各 -12px 抵消面板 padding，直角、无边框）。早先被撤掉的是
	// provider 圆角卡片（border-l3 + radius + 掺色底），别把整组重新做回卡片。
	group: { display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '8px' },
	// 分组条（provider）：全宽、吸顶。224px 的面板里只靠一行浅色小字分组不够
	// （实测反馈两次「分组不明显」），所以升级成真正的分节头条带：
	//   · 横向用负 margin 吃掉面板 12px padding，视觉上从一边到另一边；
	//   · 底色 = 菜单面同色（bg-layer-2）掺 6% label-primary，滚动时能盖住下方行；
	//   · 直角、无边框，不构成卡片。
	groupHead: {
		position: 'sticky',
		top: 0,
		zIndex: 2,
		display: 'flex',
		alignItems: 'center',
		gap: '8px',
		margin: '0 -12px',
		padding: '5px 20px',
		background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 6%, var(--dsw-alias-bg-layer-2))',
		borderTop: '1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent)',
		borderBottom: '1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent)',
		userSelect: 'none',
	},
	// 组名文字：flex 子项自己负责省略号（条本身不能 overflow:hidden，否则会裁掉吸顶内容）。
	groupLabelText: {
		minWidth: 0,
		overflow: 'hidden',
		whiteSpace: 'nowrap',
		textOverflow: 'ellipsis',
		color: 'var(--dsw-alias-label-secondary)',
		fontSize: '11px',
		fontWeight: 600,
		letterSpacing: '0.03em',
		lineHeight: '16px',
	},
	// 组内模型数：靠右，退回 tertiary，不和组名抢；tabular-nums 让数字右端对齐。
	groupCount: {
		flex: 'none',
		marginLeft: 'auto',
		color: 'var(--dsw-alias-label-tertiary)',
		fontSize: '10px',
		fontWeight: 400,
		letterSpacing: '0',
		lineHeight: '16px',
		fontVariantNumeric: 'tabular-nums',
	},
	// 组内每一行是 Codex 式的**两行行项目**：模型名 + 一行说明（当前/选中后 档位）。
	// 把档位从行尾挪进副行后，224px 下模型名不再被 High/Max 挤成省略号；
	// provider 归吸顶分节条负责，副行不再重复它（长 provider 名会把档位截掉）。
	rowButton: {
		display: 'flex',
		alignItems: 'center',
		gap: '8px',
		width: '100%',
		padding: '6px 8px',
		border: 'none',
		borderRadius: '6px',
		background: 'transparent',
		color: 'var(--dsw-alias-label-primary)',
		font: 'inherit',
		textAlign: 'left',
		cursor: 'pointer',
		transition: 'background .1s ease',
	},
	// 行的两行主体：主行（模型名）+ 副行（provider · 当前/选中后 档位）。
	rowBody: { display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 },
	// 副行：11px/14，tertiary。没有档位的模型写「无档位」（不撒谎）。
	rowDesc: {
		minWidth: 0,
		overflow: 'hidden',
		whiteSpace: 'nowrap',
		textOverflow: 'ellipsis',
		color: 'var(--dsw-alias-label-tertiary)',
		fontSize: '11px',
		lineHeight: '14px',
	},
	// 半透明菜单面上不要用 bg-layer-2（和面板几乎同色，看不出 hover）。
	rowHover: { background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent)' },
	/** 当前选中行：比 hover 再深一点，像 Codex 那样一眼看出"我在这"。 */
	rowActive: { background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 11%, transparent)' },
	rowDisabled: { opacity: 0.5, cursor: 'default' },
	list: {
		display: 'flex',
		flexDirection: 'column',
		// 行距要小（没有卡片），行本身承担 hover/选中高亮；provider 之间靠组名的
		// `groupLabel` 上内边距拉开，不用额外分隔线。
		gap: '2px',
		maxHeight: 'min(320px, 50vh)',
		overflowY: 'auto',
		// 列表滚动时不把滚动传给下面的对话列表；滚动条出现/消失时也不让面板宽度跳一格。
		overscrollBehavior: 'contain',
		scrollbarGutter: 'stable',
	},
	// 模型超过 4 个时出现的搜索框；底色与 rowHover 同源，避免在菜单面上再引入一种材质。
	search: {
		width: '100%',
		boxSizing: 'border-box',
		padding: '6px 8px',
		border: 'none',
		borderRadius: '6px',
		background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent)',
		color: 'var(--dsw-alias-label-primary)',
		font: 'inherit',
		fontSize: '12px',
	},
	modelName: {
		minWidth: 0,
		overflow: 'hidden',
		whiteSpace: 'nowrap',
		textOverflow: 'ellipsis',
		fontSize: '13px',
		lineHeight: '18px',
	},
	/** 行尾那一格：勾选图标，没有勾选时留同样宽的空格，保证模型名左对齐。 */
	slot: { width: '18px', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' },
	notice: { color: 'var(--dsw-alias-label-secondary)', fontSize: '12px', padding: '4px 2px' },
	// provider 级加载失败：没有可选行，但必须让用户看见是哪一家失败了。
	failureRow: {
		display: 'flex',
		flexDirection: 'column',
		gap: '2px',
		padding: '6px 8px',
		color: 'var(--dsw-alias-state-error-primary)',
		fontSize: '12px',
		lineHeight: '16px',
	},
	error: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: '8px',
		color: 'var(--dsw-alias-state-error-primary)',
		fontSize: '12px',
		padding: '4px 2px',
	},
	retry: {
		flex: 'none',
		padding: '2px 4px',
		border: 'none',
		borderRadius: '4px',
		background: 'transparent',
		color: 'var(--dsw-alias-brand-primary)',
		font: 'inherit',
		fontSize: '12px',
		cursor: 'pointer',
	},
	// 座位内部兜住错误时替换触发器的那一行提示（点击可重试）。
	failure: {
		display: 'flex',
		alignItems: 'center',
		height: '28px',
		padding: '0 8px',
		border: 'none',
		borderRadius: '6px',
		background: 'transparent',
		color: 'var(--dsw-alias-state-error-primary)',
		font: 'inherit',
		fontSize: '13px',
		cursor: 'pointer',
	},
} satisfies Record<string, CSSProperties>;
