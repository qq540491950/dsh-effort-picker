/**
 * 档位面板的落位。
 *
 * 面板是 `position: fixed` 的浮层（挂在 `document.body` 上的 portal），所以位置只能自己算。
 * 这里把它拆成两半：
 *
 *   1. {@link estimatePanelPosition} —— 同步、纯函数：打开面板的**第一帧**就用它给出位置，
 *      否则要等浮层测量完才出现，会看到一次"先跳到角落再归位"的闪动。
 *   2. `picker.tsx` 里的 `autoUpdate` —— 打开期间持续跟随：composer 撑高、窗口缩放、
 *      外层滚动容器移动时都重新定位（手写这套监听会漏掉 ResizeObserver 这类情况）。
 *
 * 两条规则来自实测：面板优先往上开（composer 在窗口底部），上方放不下就翻到下方；
 * 左右不越出视口，至少留 {@link PANEL_MARGIN}。
 */

/** 锚点矩形（`trigger.getBoundingClientRect()` 的形状）。 */
export interface AnchorRect {
	top: number;
	bottom: number;
	left: number;
	right: number;
}

/** 尺寸：宽高分开写，浮层未测量时传 0。 */
export interface PanelSize {
	width: number;
	height: number;
}

/** 视口尺寸（`window.innerWidth/innerHeight`）。 */
export type Viewport = PanelSize;

/** 结果：`position: fixed` 下的 left/top。 */
export interface PanelPoint {
	left: number;
	top: number;
}

/** 触发器与面板之间的缝隙。 */
export const PANEL_GAP = 8;

/** 面板与视口边缘的最小距离。 */
export const PANEL_MARGIN = 12;

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * 打开瞬间的同步定位：优先贴着触发器上方、右对齐；上方塞不下就翻到下方；
 * 两侧兜在视口里。
 *
 * @param anchor - 触发器矩形。
 * @param size - 面板尺寸（还没测量时传 `{ width: 0, height: 0 }`）。
 * @param viewport - 视口尺寸。
 * @param margin - 与视口边缘的最小距离，默认 {@link PANEL_MARGIN}。
 */
export function estimatePanelPosition(
	anchor: AnchorRect,
	size: PanelSize,
	viewport: Viewport,
	margin: number = PANEL_MARGIN,
): PanelPoint {
	const above = anchor.top - PANEL_GAP - size.height;
	const below = anchor.bottom + PANEL_GAP;
	// 上方放得下就往上开；放不下就翻到下方，但别把面板顶出视口下沿。
	const top = above >= margin ? above : Math.min(below, viewport.height - size.height - margin);
	const left = clamp(anchor.right - size.width, margin, viewport.width - size.width - margin);
	return { left, top };
}
