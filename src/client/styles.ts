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
	effortName: { color: 'var(--dsw-alias-brand-primary)', fontSize: '13px', fontWeight: 500 },
	track: {
		position: 'relative',
		// 轨道高度与 THUMB_SIZE 是同一套比例：白圆钮（25px）刻意比轨道（18px）大得多，
		// 上下各探出约 3.5px——参考图（Codex 的档位面板）里圆钮就是这么"骑"在细轨上的。
		// 改这里就要同步看 THUMB_SIZE（见 AGENTS.md 第 3 节）。
		height: '18px',
		borderRadius: '999px',
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
		// 左端淡入、右端饱和：一段渐变就够，不用引入第二支颜色，
		// 两种主题下都只依赖 brand-primary，跟着主题走。
		background:
			'linear-gradient(90deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent) 0%, var(--dsw-alias-brand-primary) 62%)',
		// 顶部一条极淡的高光，让填充看起来是"鼓"的，而不是一张色纸。
		boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, .22)',
		pointerEvents: 'none',
	},
	tick: {
		position: 'absolute',
		top: '50%',
		width: '4px',
		height: '4px',
		transform: 'translate(-50%, -50%)',
		borderRadius: '50%',
		// 停靠点要同时活在两种底上：深色轨道上靠白点，品牌填充上靠那圈黑描边。
		// 原来只有 30% 白 + 6% 描边，落在浅色填充上几乎看不见（截图里就是这样）。
		background: 'rgba(255, 255, 255, .55)',
		boxShadow: '0 0 0 1px rgba(0, 0, 0, .28), 0 1px 2px rgba(0, 0, 0, .22)',
		pointerEvents: 'none',
	},
	thumb: {
		position: 'absolute',
		top: '50%',
		width: '25px',
		height: '25px',
		transform: 'translate(-50%, -50%)',
		borderRadius: '50%',
		background: '#fff',
		// 白圆钮在深色主题里本来就分得开；浅色主题里轨道是浅灰、面板接近白，
		// 只留纯白的话圆钮边界会消失。所以：极淡描边（切边）+ 一圈品牌色光晕
		// （把它和填充"焊"在一起，圆钮不再像一颗浮在上面的白球）+ 落影（立体感）。
		boxShadow:
			'0 0 0 1px rgba(0, 0, 0, .08), 0 0 0 4px color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent), 0 2px 8px rgba(0, 0, 0, .45)',
		pointerEvents: 'none',
	},
	/** 拖动中的圆钮：放大一点点、光晕更亮（`track.tsx` 按 `dragging` 切）。 */
	thumbActive: {
		boxShadow:
			'0 0 0 1px rgba(0, 0, 0, .08), 0 0 0 6px color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent), 0 3px 12px rgba(0, 0, 0, .5)',
	},
	// 列表是 Codex 式的**平铺**（没有分组卡片，也没有组名）：分组信息退到每行的
	// `aria-label` 里，视觉上只留"模型名 + 档位 + 勾"。之前那版 provider 卡片是为
	// "分组名与模型名分不出来"加的，后来明确要求向 Codex 看齐，于是撤掉。
	rowButton: {
		display: 'flex',
		alignItems: 'center',
		gap: '8px',
		width: '100%',
		padding: '7px 8px',
		border: 'none',
		borderRadius: '6px',
		background: 'transparent',
		color: 'var(--dsw-alias-label-primary)',
		font: 'inherit',
		textAlign: 'left',
		cursor: 'pointer',
		transition: 'background .1s ease',
	},
	// 半透明菜单面上不要用 bg-layer-2（和面板几乎同色，看不出 hover）。
	rowHover: { background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent)' },
	/** 当前选中行：比 hover 再深一点，像 Codex 那样一眼看出"我在这"。 */
	rowActive: { background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 11%, transparent)' },
	rowDisabled: { opacity: 0.5, cursor: 'default' },
	list: {
		display: 'flex',
		flexDirection: 'column',
		// 平铺列表（没有卡片）行距要小，行本身承担 hover/选中高亮。
		gap: '2px',
		maxHeight: 'min(320px, 50vh)',
		overflowY: 'auto',
		// 列表滚动时不把滚动传给下面的对话列表；滚动条出现/消失时也不让面板宽度跳一格。
		overscrollBehavior: 'contain',
		scrollbarGutter: 'stable',
	},
	modelName: { flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
	/** 行尾那一格：勾选图标，没有勾选时留同样宽的空格，保证模型名左对齐。 */
	slot: { width: '18px', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' },
	notice: { color: 'var(--dsw-alias-label-secondary)', fontSize: '12px', padding: '4px 2px' },
	error: { color: 'var(--dsw-alias-state-error-primary)', fontSize: '12px', padding: '4px 2px' },
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
