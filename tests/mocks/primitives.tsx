import * as React from 'react';

function icon(name: string) {
	return function Icon(props: { size?: number; style?: React.CSSProperties }) {
		const { size, ...rest } = props;
		return React.createElement('span', { 'data-icon': name, 'data-size': size, ...rest });
	};
}

export const IconChevronDownOutlineRegular = icon('chevron-down');
export const IconChevronRightOutlineRegular = icon('chevron-right');
export const IconChevronLeftOutlineRegular = icon('chevron-left');
export const IconCheckOutlineRegular = icon('check');

export const MenuSurface = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & {
	compact?: boolean;
	children?: React.ReactNode;
}>(function MenuSurface({ compact, children, ...rest }, ref) {
	return React.createElement('div', { ...rest, ref, 'data-surface': 'menu' }, children);
});

export const StateDot = function StateDot(props: { state: string }) {
	return React.createElement('span', { 'data-state': props.state });
};
