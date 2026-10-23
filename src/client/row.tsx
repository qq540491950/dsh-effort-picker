/**
 * 面板里的一个可点行（模型、以及"返回"）。
 *
 * 它只负责"悬停高亮 + 禁用态"这一层，选中态（`aria-checked`）由调用方通过 props 给。
 */

import type { CSSProperties, ReactNode } from 'react';
import { h } from './platform';
import { useHover } from './hooks';
import { styles } from './styles';

export interface RowProps {
	/** `menuitemradio` 表示"单选一项"，读屏会念出选中状态。 */
	role?: string;
	checked?: boolean;
	disabled?: boolean;
	title?: string;
	/**
	 * 读屏用的整句标签。列表已按 provider 分组、组名可见，但 provider 仍然写进每一行：
	 * 读屏按行的顺序念，不依赖"组标题被念过"这件事；同名模型来自不同 provider 时，
	 * 这一句是唯一念得出来的区分。
	 */
	ariaLabel?: string;
	onClick?: () => void;
	children?: ReactNode;
}

/** 一行按钮。 */
export function Row(props: RowProps) {
	const [hovered, hoverHandlers] = useHover();
	const style: CSSProperties = { ...styles.rowButton };
	if (props.checked === true) Object.assign(style, styles.rowActive);
	if (hovered && props.disabled !== true) Object.assign(style, styles.rowHover);
	if (props.disabled === true) Object.assign(style, styles.rowDisabled);
	return (
		<button
			type="button"
			role={props.role}
			aria-checked={props.checked}
			aria-label={props.ariaLabel}
			title={props.title}
			style={style}
			disabled={props.disabled === true}
			onClick={props.onClick}
			{...hoverHandlers}
		>
			{props.children}
		</button>
	);
}
