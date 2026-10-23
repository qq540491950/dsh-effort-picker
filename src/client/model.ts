/**
 * 领域模型：官方 `modelDirectories` 服务交出来的那份快照的形状。
 *
 * 这些类型是**实测**出来的契约（见 AGENTS.md 第 2.2 节：我们读的是官方按会话共享的
 * 目录服务，和 `/model` 命令看到的是同一份状态），只列本插件真正读/写的字段。
 * 任何字段变化都只会波及这一个文件——不会把版本耦合带进组件。
 */

/** 一个可选档位（off / low / medium / high / max …）。 */
export interface EffortLevel {
	id: string;
	name: string;
}

/** 模型的推理能力声明。`efforts` 为空表示这个模型没有档位可选。 */
export interface ReasoningInfo {
	efforts: EffortLevel[];
	/** 选中这个模型时不指定档位就用的那一档。 */
	defaultEffort?: string;
}

/** 目录里的一个模型。`name` 缺省时用 `id` 的最后一段展示。 */
export interface ModelEntry {
	id: string;
	name?: string;
	reasoning?: ReasoningInfo;
}

/** 一个 provider 分组（官方也按 provider 分组）。 */
export interface ModelGroup {
	id: string;
	name?: string;
	models: ModelEntry[];
}

/** "下一次请求用哪个模型/档位"。写入只影响下一次请求。 */
export interface ModelSelection {
	provider: string;
	model: string;
	reasoningEffort?: string;
}

/** 一个 provider 的目录加载失败；可用分组仍然可用，失败行只做提示。 */
export interface ModelFailure {
	id: string;
	name?: string;
	message: string;
}

/** 目录快照：`directory.store.getSnapshot()` 的返回值，也是 `useSyncExternalStore` 的源。 */
export interface DirectorySnapshot {
	/** 'ready' / 'loading' … 这里只用到 'loading' 一个值做文案。 */
	status: string;
	current: ModelSelection | null | undefined;
	/** 还没有 current 时（目录没载入完）先显示的档位。 */
	retainedEffort?: string;
	groups: ModelGroup[];
	/** 正在提交的选择；null 表示没有进行中的选择。 */
	pending: ModelSelection | null;
	/** 上一次操作的失败文案（已经是给人看的字符串）。 */
	error: string | null;
	/** 官方快照里还有这两个字段；本插件不读，写出来是为了让夹具能如实构造快照。 */
	routable?: boolean;
	/** 上一次目录加载中按 provider 失败的条目；可用分组不受影响。 */
	failures?: ModelFailure[];
}

/** `directory.select()` 的结果：`ok: false` 时 `error.code` 决定提示语。 */
export interface SelectFailure {
	code?: string;
	message?: string;
}

export type SelectOutcome = { ok: true; value?: unknown } | { ok: false; error: SelectFailure };
