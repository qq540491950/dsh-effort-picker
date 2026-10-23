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
 * 形状与滚动条兜底样式表（唯一的 CSS 注入）。
 *
 * 为什么需要它：实测在 DSH 的 popover 里，我们内联写的 `border-radius: 999px / 50%`
 * 会被渲染成约 8px 的圆角——轨道两端从半圆变成圆角矩形、滑块从正圆变成圆角方块
 * （用户截图实测，见 AGENTS.md 第 3 节的形状一行）。内联声明被**后来的**同等声明盖掉时，
 * 只有 `!important` 能赢；而 `clip-path` 虽然也抗改圆角，却会连子树一起裁，
 * 把滑块探出轨道的那 1.5px 切平，所以轨道只能用这条样式表。
 *
 * 另外列表要**隐藏滚动条**（用户要求，见 AGENTS.md 第 3 节）：inline style 只能写
 * `scrollbar-width: none`，Chromium 的 `::-webkit-scrollbar` 伪元素必须靠这条样式表。
 * 选择器全部基于我们自己的 data 属性，不会波及宿主 UI；生命周期由 `ctx.effect` 管，
 * 插件卸载/热替换时自动移除。
 */
export const SHAPE_CSS = [
	'[data-dsh-effort-picker-track]{border-radius:999px!important}',
	'[data-dsh-effort-picker-fill]{border-radius:999px!important}',
	'[data-dsh-effort-picker-tick]{border-radius:50%!important}',
	'[data-dsh-effort-picker-thumb]{border-radius:50%!important}',
	'[data-dsh-effort-picker-list]{scrollbar-width:none!important;-ms-overflow-style:none!important}',
	'[data-dsh-effort-picker-list]::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}',
].join('');

/** 把 {@link SHAPE_CSS} 插进 `<head>`，返回移除函数（给 `ctx.effect` 当 disposer）。 */
function installShapeStyles(): () => void {
	if (typeof document === 'undefined') return () => {};
	const head = document.head;
	if (head === undefined) return () => {};
	const style = document.createElement('style');
	style.setAttribute('data-dsh-effort-picker', 'shape');
	style.textContent = SHAPE_CSS;
	head.appendChild(style);
	return () => style.remove();
}

/**
 * 客户端插件体：以 priority -1 遮蔽官方的 `conversation.input.model` 座位。
 *
 * @param ctx - 客户端根上下文。
 */
export function apply(ctx: ClientContext): void {
	ctx.effect(installShapeStyles);

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
