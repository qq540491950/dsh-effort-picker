/**
 * `@deepseek-ai/dsh-client-ui-primitives` 的最小声明。
 *
 * 为什么手写而不是用官方类型：DSH 对插件只投 `lib/` 下的 `.js`，不投 `.d.ts`（安装目录里
 * 一个声明文件都没有），而本仓库又刻意只有一个 peer（`@deepseek-ai/cordis`）。
 * 所以这里只列**真正用到的**那一小撮导出——官方加参数不会波及我们，我们也不会
 * 因为版本耦合而编译不了。
 *
 * 纪律：只加在 `src/client/` 里真的渲染过的成员；没用到的不写。
 */

declare module '@deepseek-ai/dsh-client-ui-primitives' {
	import type { ComponentType, CSSProperties, ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react';

	/** 图标组件的公共 props（官方图标都是 `size` + 透传 style）。 */
	export interface IconProps {
		size?: number;
		style?: CSSProperties;
	}

	export const IconChevronDownOutlineRegular: ComponentType<IconProps>;
	export const IconChevronRightOutlineRegular: ComponentType<IconProps>;
	export const IconChevronLeftOutlineRegular: ComponentType<IconProps>;
	export const IconCheckOutlineRegular: ComponentType<IconProps>;

	/** 菜单材质面：`compact` 走小号内边距，`ref` 指向真实 DOM（定位要用）。 */
	export interface MenuSurfaceProps {
		children?: ReactNode;
		compact?: boolean;
		role?: string;
		style?: CSSProperties;
		'aria-label'?: string;
		'aria-busy'?: boolean;
	}

	export const MenuSurface: ForwardRefExoticComponent<MenuSurfaceProps & RefAttributes<HTMLElement>>;

	/** 进行中状态的呼吸点（busy 时替代 chevron）。 */
	export interface StateDotProps {
		state: string;
	}

	export const StateDot: ComponentType<StateDotProps>;
}
