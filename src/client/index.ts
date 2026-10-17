/**
 * 客户端插件体与模块出口。
 *
 * `window.__ModuleLoader__.load(...)` **不在**源码里——它由 `tools/build.ts` 的海报/页脚
 * 包在产物外面。源码这边只负责导出 `apply`：产物就是「一个 factory，返回带 apply 的 exports」。
 * 这样 TypeScript 可以正常按 ESM 写、按打包器解析，而投递契约（classic script + 懒 CJS）
 * 只在一个地方（构建脚本）被保证。
 */

import { CodexEffortPicker } from './picker';
import type { ClientContext } from './services';

/** 面板落位的纯函数：导出它只为让 `tools/verify.mjs` 能离线断言翻转/夹边行为。 */
export { estimatePanelPosition } from './placement';

/**
 * 客户端插件体：以 priority -1 遮蔽官方的 `conversation.input.model` 座位。
 *
 * @param ctx - 客户端根上下文。
 */
export function apply(ctx: ClientContext): void {
	// 注入清单必须覆盖**官方代码经由 `this.ctx` 碰到的每一项服务**。
	//
	// Cordis 的 Service 方法被外部插件调用时，`this.ctx` 会重绑到**调用方**的上下文。
	// `modelDirectories.directoryFor()` 内部要 `this.ctx.remote.session`，
	// 所以 "remote" / "remote.session" 必须写进我们的清单；"sessions" 同理
	// （注入面里的 `sessions.subagentAddress` 也要用）。缺任何一项，只要该会话的
	// 目录还没被官方插件建过（缓存未命中），就会抛
	// `cannot get property "remote.session" without inject`。
	ctx.inject(['slots', 'modelDirectories', 'sessions', 'remote', 'remote.session'], (scope) => {
		const models = scope.modelDirectories;
		const sessions = scope.sessions;
		scope.slots.inject('conversation.input.model', () =>
			scope.slots.register(
				{
					name: 'conversation.input.model',
					// 官方注册在 priority 0；single 座位取"priority 最低者渲染"，
					// 所以 -1 就能接管渲染，而官方插件与它的 /model 命令完全不受影响。
					priority: -1,
					// 只交出**解析闭包**，绝不在这里解析。
					//
					// 理由有两条：
					// 1. inject 工厂抛错会撞上遮蔽规则（见 boundary.tsx），条目被退役；
					// 2. 解析本身就是"可能失败"的动作——会话的目录服务按需创建，
					//    官方 directoryFor() 对没有 retained generation 的会话是 fail loud。
					// 推迟到渲染期，由座位内的 SeatBoundary 兜住并自动重试。
					inject: (sessionId: string) => ({
						resolve: () => {
							const directory = models.directoryFor(sessionId);
							return {
								available: sessions.subagentAddress(sessionId) === undefined,
								directory,
							};
						},
					}),
				},
				CodexEffortPicker,
			),
		);
	});
}
