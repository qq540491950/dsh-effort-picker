/**
 * 需要自己记下来的交互态。
 *
 * inline style 拿不到 `:hover`（见 `styles.ts` 的说明），所以"这一行是不是被指着"
 * 只能由 React 状态兜着。做成 hook 是为了 let 多个组件共用同一套语义。
 */

import { react } from './platform';

/** 挂到元素上的两个鼠标事件。 */
export interface HoverHandlers {
	onMouseEnter: () => void;
	onMouseLeave: () => void;
}

/** 返回 `[是否悬停, 事件处理器]`。 */
export function useHover(): [boolean, HoverHandlers] {
	const [hovered, setHovered] = react.useState(false);
	return [
		hovered,
		{
			onMouseEnter: () => setHovered(true),
			onMouseLeave: () => setHovered(false),
		},
	];
}
