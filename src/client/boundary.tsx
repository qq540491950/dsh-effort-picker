/**
 * 座位内部的错误边界——**这不是可选项**。
 *
 * DSH 的渲染器在座位条目**外层**还有一层边界（`SlotErrorBoundary`），而对
 * single / keyed / list 这类"遮蔽型"座位，外层边界一旦捕获错误就调用
 * `reportEntryError(..., { abdicate: true })` **把整个条目退役**：控件从界面上
 * 彻底消失，官方控件顶上来，而且要等页面重新加载（或 bundle 被重新发布）才回得来。
 * 座位内部先兜住，条目就永远不会被退役——失败降级成一行可点击重试的提示，下一次渲染
 * 还有机会自愈。
 */

import type { ReactNode } from 'react';
import { react, h } from './platform';
import { styles } from './styles';

interface SeatBoundaryProps {
	children?: ReactNode;
}

interface SeatBoundaryState {
	failure: unknown;
}

/** 包住整个座位子树；失败时换成一个可点击重试的按钮。 */
export class SeatBoundary extends react.Component<SeatBoundaryProps, SeatBoundaryState> {
	private timer: ReturnType<typeof setTimeout> | null;

	private retries: number;

	constructor(props: SeatBoundaryProps) {
		super(props);
		this.state = { failure: null };
		this.timer = null;
		this.retries = 0;
		this.retry = this.retry.bind(this);
	}

	/** React 边界协议：把抛出的错误转成状态。 */
	static getDerivedStateFromError(error: unknown): SeatBoundaryState {
		return { failure: error };
	}

	/**
	 * 记录真实错误，并安排一次自动重试。
	 *
	 * 绝大多数原因是**瞬时**的（目录服务好像还没就绪），所以先自动重试几次；
	 * 重试耗尽还失败就停在提示上，等用户点击。控制台只在第一次失败时打一条，
	 * 否则重试会把控制台刷屏。
	 */
	componentDidCatch(error: unknown): void {
		const detail = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
		if (this.retries === 0) console.error('[dsh-effort-picker] 座位渲染失败：', error);
		// 留一份落盘的记录：出问题时不必开 DevTools 也能读到原因。
		try {
			window.localStorage.setItem('dsh-effort-picker:last-failure', `${new Date().toISOString()}\n${detail}`);
		} catch {
			/* 存储不可用时只剩控制台 */
		}
		if (this.retries < 12) {
			this.retries += 1;
			this.timer = setTimeout(this.retry, 150);
		}
	}

	/** 卸载时清掉待重试的定时器。 */
	componentWillUnmount(): void {
		if (this.timer !== null) clearTimeout(this.timer);
	}

	/** 清掉失败态：子树重新挂载，也就是再解析一次注入面。 */
	retry(): void {
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.setState({ failure: null });
	}

	/** 正常时渲染子树；失败时渲染一行提示。 */
	render(): ReactNode {
		if (this.state.failure === null) return this.props.children;
		const failure = this.state.failure;
		const message = failure instanceof Error ? `${failure.name}: ${failure.message}` : String(failure);
		return (
			<button type="button" style={styles.failure} title={message} onClick={this.retry}>
				推理等级控件异常，点击重试
			</button>
		);
	}
}
