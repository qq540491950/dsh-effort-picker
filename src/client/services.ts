/**
 * 客户端半边用到的 Cordis Service 形状 —— 只列真正调用的成员。
 *
 * 为什么不用官方类型：DSH 只投 `.js`（没有 `.d.ts` 可 import），而且这些形状都是
 * **实测**出来的（座位注册选项、目录 store 的 subscribe/getSnapshot、select 的结果）。
 * 写成最小接口后，官方契约变化只会影响这一个文件。
 *
 * 注意 `ClientScope` 里的成员与 `apply()` 的 `ctx.inject([...])` 清单**必须对得上**：
 * Cordis 的 Service 方法以调用方上下文求值，`directoryFor()` 内部要
 * `this.ctx.remote.session`，所以清单里缺 `remote` / `remote.session` 时，
 * 缓存未命中的会话（切换会话）必炸 "without inject"。见 AGENTS.md 第 2.2 节。
 */

import type { ComponentType } from 'react';
import type { DirectorySnapshot, ModelSelection, SelectOutcome } from './model';

/** `directory.store`：官方的 snapshot store。 */
export interface DirectoryStore {
	subscribe(listener: () => void): () => void;
	getSnapshot(): DirectorySnapshot;
}

/** 一个会话的模型目录（官方 `directoryFor()` 的返回值）。 */
export interface ModelDirectory {
	store: DirectoryStore;
	load(): Promise<unknown>;
	select(selection: ModelSelection): Promise<SelectOutcome | undefined>;
}

/** `ctx.modelDirectories`：按会话共享的目录服务。 */
export interface ModelDirectoriesService {
	directoryFor(sessionId: string): ModelDirectory;
}

/** `ctx.sessions`：这里只用它判断"当前会话是不是被寻址的子代理会话"。 */
export interface SessionsService {
	subagentAddress(sessionId: string): unknown;
}

/** 座位注入面：只交出解析闭包，**绝不在**工厂里解析（见 AGENTS.md 第 2.1 节）。 */
export interface SeatFace {
	resolve(): ResolvedSeat;
}

/** 解析结果：`available === false` 表示子代理会话，组件什么都不渲染。 */
export interface ResolvedSeat {
	available: boolean;
	directory: ModelDirectory;
}

/** 座位注册选项。`conversation.input.model` 是 single 座位：`priority` 最低者渲染。 */
export interface SeatRegistration {
	name: string;
	priority: number;
	inject(sessionId: string): SeatFace;
}

/** 座位的组件契约：owner 份额（`locked`）+ 注入面（`resolve`）。 */
export interface SeatProps {
	locked?: boolean;
	resolve: () => ResolvedSeat;
}

/** `ctx.slots`：声明一个座位（可晚注册）+ 往里注册一个组件。 */
export interface SlotsService {
	inject(ownerKey: string, callback: () => void): void;
	register(registration: SeatRegistration, component: ComponentType<SeatProps>): unknown;
}

/** `ctx.inject([...], scope => …)` 回调收到的 scope。 */
export interface ClientScope {
	slots: SlotsService;
	modelDirectories: ModelDirectoriesService;
	sessions: SessionsService;
}

/** 客户端根上下文：这里只用到 inject。 */
export interface ClientContext {
	inject(services: string[], callback: (scope: ClientScope) => void): unknown;
}
