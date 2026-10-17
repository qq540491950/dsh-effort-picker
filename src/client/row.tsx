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
	onClick?: () => void;
	children?: ReactNode;
}

/** 一行按钮。 */
export function Row(props: RowProps) {
	const [hovered, hoverHandlers] = useHover();
	const style: CSSProperties = { ...styles.rowButton };
	if (hovered && props.disabled !== true) Object.assign(style, styles.rowHover);
	if (props.disabled === true) Object.assign(style, styles.rowDisabled);
	return (
		<button
			type="button"
			role={props.role}
			aria-checked={props.checked}
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
