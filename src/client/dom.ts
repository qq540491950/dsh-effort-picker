/**
 * 直接改 DOM 的小工具。
 *
 * 拖动时滑块与进度填充要**立刻**跟手，不能等 React 渲染（一次 setState 的往返就是
 * 一帧的滞后，手感会发黏），所以这两个元素在 `onPointerMove` 里被直接写 style。
 * 真实 DOM 一定有 `style`，但离线自检用的是假节点（没有 style），因此取值必须容错。
 */

/** 允许直接写的内联样式子集。 */
export interface InlineStylePatch {
	left?: string;
	width?: string;
}

/**
 * 往节点的内联样式里写几项；节点或 style 不存在时安静跳过。
 *
 * @param node - 目标节点（通常是 `thumbRef.current` / `fillRef.current`）。
 * @param patch - 要写入的样式。
 */
export function writeInlineStyle(node: Element | null, patch: InlineStylePatch): void {
	const style = (node as (Element & { style?: InlineStylePatch }) | null)?.style;
	if (style === undefined) return;
	Object.assign(style, patch);
}
