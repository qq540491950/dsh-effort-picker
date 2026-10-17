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
		gap: '4px',
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
		gap: '10px',
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
	headerTitle: {
		maxWidth: '100%',
		overflow: 'hidden',
		whiteSpace: 'nowrap',
		textOverflow: 'ellipsis',
		textAlign: 'center',
		color: 'var(--dsw-alias-brand-primary)',
		fontSize: '14px',
		fontWeight: 500,
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
	// provider 分组：每个 provider 一张圆角卡片把整组框起来——只靠字色/字号分层，
	// 反馈里仍然"不明显"。底色按 label-primary 掺 5%（不能裸用 bg-layer-2：
	// 它和半透明菜单面几乎同色，卡片会消失），边框用 border-l3
	// （l1 只有 4%~6% 不透明度、框不出来；l2 是 10%/12%，l3 是 12%/16%）。
	group: {
		display: 'flex',
		flexDirection: 'column',
		gap: '2px',
		padding: '4px',
		border: '1px solid var(--dsw-alias-border-l3)',
		borderRadius: 'var(--dsw-radius-md)',
		background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent)',
	},
	// 组名：label-tertiary（浅色 #81858c / 深色 #adb2b8，比模型行的 label-primary
	// 暗两档，官方 MenuGroup 就是这个取值）+ 11px/500 + 字距，读起来是"标签"。
	groupHeading: {
		padding: '2px 6px 4px',
		color: 'var(--dsw-alias-label-tertiary)',
		fontSize: '11px',
		fontWeight: 500,
		letterSpacing: '0.05em',
	},
	effortName: { color: 'var(--dsw-alias-brand-primary)', fontSize: '13px', fontWeight: 500 },
	track: {
		position: 'relative',
		// 轨道高度与 THUMB_SIZE 是同一套比例：白色圆钮（25px）刻意比轨道（22px）大一点，
		// 会从轨道上下各探出约 1.5px——参考图里的圆钮就是这么"坐"在轨道上的。
		height: '22px',
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
		background: 'var(--dsw-alias-brand-primary)',
		pointerEvents: 'none',
	},
	tick: {
		position: 'absolute',
		top: '50%',
		width: '4px',
		height: '4px',
		transform: 'translate(-50%, -50%)',
		borderRadius: '50%',
		// 半透明白点 + 一圈极淡的黑描边：白点在深色轨道/品牌色填充上都看得见；
		// 浅色主题里轨道与填充一个接近白、一个接近黑，就靠描边把点勾出来。
		background: 'rgba(255, 255, 255, .30)',
		boxShadow: '0 0 0 1px rgba(0, 0, 0, .18)',
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
		// 只留纯白的话圆钮边界会消失。一圈极淡描边 + 一层投影把边界勾出来——
		// 参考图里没有这两样，但那是在深色主题下截的。
		boxShadow: '0 0 0 1px rgba(0, 0, 0, .10), 0 1px 4px rgba(0, 0, 0, .35)',
		pointerEvents: 'none',
	},
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
	},
	rowHover: { background: 'var(--dsw-alias-bg-layer-2)' },
	rowDisabled: { opacity: 0.5, cursor: 'default' },
	list: {
		display: 'flex',
		flexDirection: 'column',
		gap: '6px',
		maxHeight: 'min(320px, 50vh)',
		overflowY: 'auto',
		// 列表滚动时不把滚动传给下面的对话列表；滚动条出现/消失时也不让面板宽度跳一格。
		overscrollBehavior: 'contain',
		scrollbarGutter: 'stable',
	},
	modelName: { flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
	slot: { width: '16px', flex: 'none', display: 'inline-flex', alignItems: 'center' },
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
