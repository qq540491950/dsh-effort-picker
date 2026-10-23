/**
 * dsh-effort-picker 自检程序（纯 Node，无依赖）。
 *
 * 它把 DSH 的投递链路和本插件的组件行为在本地"离线重放"一遍，不需要启动 DSH：
 *   1. package.json 是否满足 Host 的扫描契约；
 *   2. lib/index.js 宿主半边是否导出 apply；
 *   3. lib/client.js 是否遵守 window.__ModuleLoader__ 协议；
 *   4. 座位注册是否用了 priority -1（遮蔽官方），注入清单是否覆盖官方 directoryFor()
 *      经由**调用方上下文**碰到的服务（remote / remote.session / sessions）；
 *   5. 注入面 resolve() 的可用性判定与目录解析，以及解析失败时的降级（不退役条目）；
 *   6. 组件渲染：触发器文案、滑杆 ARIA、停靠点数量、滑块位置；
 *   7. 拖拽提交（一次手势只提交一次）、键盘调档、模型下钻、失败提示、子代理短路。
 *
 * 用法（Node 24 直接跑 .ts，靠原生类型剥离；构建脚本同理）：
 *   node tools/verify.ts
 *   node tools/verify.ts --patch "C:\Users\admin\.dsh\profiles\desktop\cordis.patch.yml"
 *   node tools/verify.ts --patch <...> --yaml <yaml 包目录>
 *
 * 它是**纯 TypeScript **，但只用到可擦除语法（`tsconfig.tools.json` 的 `erasableSyntaxOnly`
 * 守着），所以不需要构建：`import type` 会在执行前被剥掉，运行时依赖只有 Node 标准库。
 * 替身/夹具刻意用了宽松类型（`any`）——它们模拟的是动态的 React 元素树；真正被类型约束的是
 * 夹具的数据形状（直接复用 `src/client/model.ts` 的领域类型，契约漂了这里会编译不过）。
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve, isAbsolute, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import type { DirectorySnapshot, EffortLevel, ModelGroup, ModelSelection } from '../src/client/model.ts';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const failures: string[] = [];
const notes: string[] = [];
function check(label: string, condition: unknown, detail?: unknown): boolean {
	if (condition) {
		console.log(`  ok   ${label}`);
		return true;
	}
	failures.push(`${label}${detail === undefined ? '' : ` — ${String(detail)}`}`);
	console.log(`  FAIL ${label}${detail === undefined ? '' : ` — ${String(detail)}`}`);
	return false;
}
function section(title: string): void {
	console.log(title);
}

//#region 极简 React / DOM 替身
/** 假元素：`type` 可能是标签名，也可能是组件函数；断言全靠 `props` / `children`。 */
interface FakeElement {
	type: any;
	props: Record<string, any>;
	children: any[];
}

/** 假 DOM 节点：够组件里那几处读宽高、拿 rect、抓指针即可。 */
interface FakeDomNode {
	tag: any;
	offsetWidth: number;
	offsetHeight: number;
	getBoundingClientRect: () => { left: number; top: number; right: number; bottom: number; width: number; height: number };
	contains: () => boolean;
	querySelector: () => null;
	focus: () => void;
	setPointerCapture: () => void;
}

/**
 * 极简 class 组件基类：只实现 `state` / `setState`，刚好够跑错误边界协议
 * （`getDerivedStateFromError` + `componentDidCatch`）。
 */
class ComponentStub {
	props: Record<string, any>;

	state: Record<string, any>;

	constructor(props?: Record<string, any>) {
		this.props = props ?? {};
		this.state = {};
	}

	setState(next: unknown): void {
		const patch = typeof next === 'function' ? (next as (state: Record<string, any>) => unknown)(this.state) : next;
		this.state = { ...this.state, ...(patch as Record<string, any>) };
	}
}

/** 本插件用到的钩子 + createElement；别的 React API 故意不实现（用不到就不给假象）。 */
interface ReactStub {
	Component: typeof ComponentStub;
	reset(): void;
	mount(): void;
	useState<T>(initial: T | (() => T)): [T, (next: T | ((previous: T) => T)) => void];
	useRef<T>(initial: T): { current: T };
	useId(): string;
	useEffect(): void;
	useLayoutEffect(): void;
	useSyncExternalStore<T>(subscribe: (listener: () => void) => () => void, getSnapshot: () => T): T;
	createElement(type: any, props?: Record<string, any> | null, ...children: any[]): FakeElement;
}

/** 让 useState 真正保存状态、useRef 真正持有对象，从而能观察交互后的重渲染。 */
function createReactStub(): ReactStub {
	const slots: any[] = [];
	let cursor = 0;
	const react: ReactStub = {
		Component: ComponentStub,
		reset() {
			cursor = 0;
		},
		mount() {
			slots.length = 0;
			cursor = 0;
		},
		useState<T>(initial: T | (() => T)) {
			const slot = cursor;
			cursor += 1;
			if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? (initial as () => T)() : initial;
			return [
				slots[slot] as T,
				(next: T | ((previous: T) => T)) => {
					slots[slot] = typeof next === 'function' ? (next as (previous: T) => T)(slots[slot] as T) : next;
				},
			];
		},
		useRef<T>(initial: T) {
			const slot = cursor;
			cursor += 1;
			if (!(slot in slots)) slots[slot] = { current: initial };
			return slots[slot] as { current: T };
		},
		useId() {
			const slot = cursor;
			cursor += 1;
			if (!(slot in slots)) slots[slot] = `test-${String(slot)}`;
			return slots[slot] as string;
		},
		useEffect() {},
		useLayoutEffect() {},
		useSyncExternalStore<T>(_subscribe: (listener: () => void) => () => void, getSnapshot: () => T): T {
			return getSnapshot();
		},
		createElement(type: any, props?: Record<string, any> | null, ...children: any[]): FakeElement {
			const { ref, ...rest } = props ?? {};
			if (ref !== undefined && typeof ref === 'object' && ref !== null && 'current' in ref) {
				(ref as { current: unknown }).current = createFakeNode(type);
			}
			return { type, props: rest, children };
		},
	};
	return react;
}

function createFakeNode(tag: any): FakeDomNode {
	return {
		tag,
		offsetWidth: 300,
		offsetHeight: 200,
		getBoundingClientRect: () => ({ left: 0, top: 0, right: 200, bottom: 34, width: 200, height: 34 }),
		contains: () => false,
		querySelector: () => null,
		focus: () => {},
		setPointerCapture: () => {},
	};
}

/** ui-primitives 替身：每个导出都渲染成一个带标记的 span。 */
function createPrimitivesStub(react: ReactStub): Record<string, (props: Record<string, any>) => FakeElement> {
	const icon = (name: string) => (props: Record<string, any>) =>
		react.createElement('span', { 'data-icon': name, style: props?.style });
	return {
		MenuSurface: (props: Record<string, any>) =>
			react.createElement('div', {
				'data-surface': 'menu',
				id: props?.id,
				role: props?.role,
				'aria-label': props?.['aria-label'],
				style: props?.style,
			}, props?.children),
		IconDataOutlineRegular: icon('data'),
		IconChevronDownOutlineRegular: icon('chevron-down'),
		IconChevronRightOutlineRegular: icon('chevron-right'),
		IconChevronLeftOutlineRegular: icon('chevron-left'),
		IconCheckOutlineRegular: icon('check'),
		StateDot: (props: Record<string, any>) => react.createElement('span', { 'data-state': props?.state }),
	};
}

/** 遍历元素树。 */
function walk(node: any, visit: (node: FakeElement) => void): void {
	if (node === null || node === undefined || typeof node === 'boolean') return;
	if (Array.isArray(node)) {
		for (const child of node) walk(child, visit);
		return;
	}
	if (typeof node !== 'object') return;
	visit(node);
	for (const child of node.children ?? []) walk(child, visit);
}

function findAll(tree: any, predicate: (node: FakeElement) => boolean): FakeElement[] {
	const out: FakeElement[] = [];
	walk(tree, (node) => {
		if (predicate(node)) out.push(node);
	});
	return out;
}

function textOf(tree: any): string {
	let text = '';
	walk(tree, (node) => {
		for (const child of node.children ?? []) if (typeof child === 'string') text += child;
	});
	return text;
}
//#endregion

//#region 载入 bundle
/** 只声明自检真正读的字段（包清单契约见 AGENTS.md 第 4 节）。 */
interface PackageManifest {
	name: string;
	exports: Record<string, string>;
	dsh?: { client?: { platform?: string }; bundle?: { patch?: string } };
}
const manifest: PackageManifest = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));
const clientPath = resolve(PACKAGE_ROOT, manifest.exports['./client']);
const clientSource = readFileSync(clientPath, 'utf8');
const reactStub = createReactStub();
const primitivesStub = createPrimitivesStub(reactStub);
const reactDomStub = { createPortal: (element: any) => element };
/** 沙箱 console 替身：记录上报内容，供"失败必须被上报"的断言使用。 */
const consoleErrors: string[] = [];
/** 沙箱定时器替身：只记录被排期的回调（边界自动重试是 150ms 级，测试里不真的跑）。 */
const pendingTimers: Array<() => void> = [];

interface LoadedBundle {
	registration: { id: string; factory: (require: (specifier: string) => unknown) => any };
	exports: any;
}

function loadClientBundle(): LoadedBundle {
	let captured: LoadedBundle['registration'] | undefined;
	const sandbox = {
		console: {
			error: (...parts: unknown[]) => consoleErrors.push(parts.map((part) => String(part)).join(' ')),
			warn: () => {},
			log: () => {},
		},
		setTimeout: (fn: () => void) => {
			pendingTimers.push(fn);
			return pendingTimers.length;
		},
		clearTimeout: () => {},
		window: {
			__ModuleLoader__: {
				load(registration: LoadedBundle['registration']) {
					captured = registration;
				},
			},
			addEventListener: () => {},
			removeEventListener: () => {},
			innerWidth: 1280,
			innerHeight: 800,
		},
		document: {
			addEventListener: () => {},
			removeEventListener: () => {},
			body: {},
			head: { appendChild: () => {} },
			createElement: () => ({
				style: {},
				dataset: {},
				setAttribute: () => {},
				textContent: '',
				remove: () => {},
			}),
		},
		Element: class Element {},
		queueMicrotask: (fn: () => void) => fn(),
	};
	vm.runInNewContext(clientSource, sandbox, { filename: 'lib/client.js' });
	if (captured === undefined) throw new Error('bundle 没有调用 window.__ModuleLoader__.load');
	const exports = captured.factory((specifier: string) => {
		if (specifier === 'react') return reactStub;
		if (specifier === 'react-dom') return reactDomStub;
		if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return primitivesStub;
		throw new Error(`bundle 请求了未播种的模块：${specifier}`);
	});
	return { registration: captured, exports };
}

//#endregion

//#region 假 ctx / 假目录服务
const EFFORT_LEVELS: EffortLevel[] = ['off', 'low', 'medium', 'high', 'max'].map((id) => ({
	id,
	name: `${id.charAt(0).toUpperCase()}${id.slice(1)}`,
}));
const GROUPS: ModelGroup[] = [
	{
		id: 'cpa',
		name: 'cpa',
		models: [
			{
				id: 'cn:deepseek-v4.1-flash',
				name: 'deepseek-v4.1-flash',
				reasoning: { efforts: EFFORT_LEVELS, defaultEffort: 'max' },
			},
			// 路由默认档（`defaultEffort`）**故意不等于最高档**：切过去必须落在最高档 High，
			// 而不是路由默认的 low —— 这是"huawei 都是 high"那次实测反馈的回归护栏。
			{ id: 'cn:glm-5.3', name: 'glm-5.3', reasoning: { efforts: EFFORT_LEVELS.slice(1, 4), defaultEffort: 'low' } },
			// **没有** defaultEffort（真实例子里 tengxun 那条路由就没有路由默认档）：
			// 切过去仍必须带上最高档，绝不能"不带档位"——那会把会话档位清空，滑块随即没有滑块头。
			{ id: 'cn:glm-5.3-flash', name: 'glm-5.3-flash', reasoning: { efforts: EFFORT_LEVELS.slice(1, 5) } },
		],
	},
	// 第二个 provider：分组标题的回归护栏。真实场景就是"官方 provider + 用户配置的第三方路由"
	// 混在同一个列表里——那时只靠 aria-label 时肉眼分不出谁家的（实测反馈：分组要加回来）。
	{
		id: 'deepseek',
		name: 'DeepSeek 官方',
		models: [{ id: 'deepseek-chat', name: 'deepseek-chat', reasoning: { efforts: EFFORT_LEVELS.slice(0, 3) } }],
	},
	// 没有模型的 provider 不许渲染出空组名。
	{ id: 'unused', name: '未使用的路由', models: [] },
];
const SNAPSHOT: DirectorySnapshot = {
	status: 'ready',
	current: { provider: 'cpa', model: 'cn:deepseek-v4.1-flash', reasoningEffort: 'medium' },
	retainedEffort: undefined,
	routable: true,
	groups: GROUPS,
	failures: [],
	pending: null,
	error: null,
};

/** `createHarness` 的可调开关。 */
interface HarnessOptions {
	/** false：模拟被寻址的子代理会话（`sessions.subagentAddress` 返回地址）。 */
	available?: boolean;
	/** `directory.select()` 的返回值；用来测"选择被拒"。 */
	selectOutcome?: unknown;
	/** 覆盖目录快照。 */
	snapshot?: DirectorySnapshot;
	/** true：模拟官方 `directoryFor()` 在调用方上下文里 fail loud。 */
	directoryThrows?: boolean;
}

/** 假宿主环境的可观察面。 */
interface Harness {
	ctx: any;
	registrations: Array<{ registration: any; component: any }>;
	calls: { load: number; select: ModelSelection[] };
	directory: any;
	injected: string[][];
}

/**
 * 搭一个可观察的宿主环境。
 * @param options - available / selectOutcome / snapshot / directoryThrows。
 */
function createHarness(options: HarnessOptions = {}): Harness {
	const calls: Harness['calls'] = { load: 0, select: [] };
	const directory = {
		store: {
			getSnapshot: () => options.snapshot ?? SNAPSHOT,
			subscribe: () => () => {},
		},
		load: async () => {
			calls.load += 1;
			return options.snapshot ?? SNAPSHOT;
		},
		select: async (selection: ModelSelection) => {
			calls.select.push(selection);
			return options.selectOutcome ?? { ok: true, value: undefined };
		},
	};
	// directoryThrows 模拟"官方 directoryFor() 在调用方上下文里 fail loud"
	// （真实场景：我们的 inject 清单缺 remote.session，缓存未命中的会话上会抛）。
	const modelDirectories = {
		directoryFor: () => {
			if (options.directoryThrows === true) throw new Error('cannot get property "remote.session" without inject');
			return directory;
		},
	};
	const subagentAddress = () => (options.available === false ? { agentId: 'a', sessionId: 's' } : undefined);

	const registrations: Harness['registrations'] = [];
	const injected: string[][] = [];
	const ctx = {
		// Cordis 的副作用登记：立刻执行回调，把它的 disposer 当作返回值。
		// 形状兜底样式表就挂在这里（`apply` 一进来就注入）。
		effect(callback: () => () => void) {
			return callback();
		},
		inject(services: string[], callback: (scope: any) => void) {
			injected.push(services);
			const scope: any = {
				modelDirectories,
				sessions: { subagentAddress },
				slots: {
					inject(key: string, cb: () => unknown) {
						scope.slots.key = key;
						return cb();
					},
					register(registration: any, component: any) {
						registrations.push({ registration, component });
						return () => {};
					},
				},
			};
			if (services.includes('slots')) callback(scope);
			return () => {};
		},
	};
	return { ctx, registrations, calls, directory, injected };
}

/**
 * 展开一个元素：函数组件直接调用；class 组件按 React 错误边界协议展开，
 * 整棵子树都受该边界保护（子树里任何一层抛错都先落到最近的边界上）。
 * @param node - 元素节点。
 * @param depth - 递归深度护栏。
 * @returns 展开后的节点（宿主元素、null 或文本）。
 */
function expandElement(node: any, depth = 0): any {
	if (depth > 16) return node;
	const type = node?.type;
	if (typeof type !== 'function') return node;
	// 真 React 把 children 放进 props；替身把它们留在 node.children，这里补上，
	// 否则错误边界 render() 里的 this.props.children 会是 undefined。
	const props = { ...(node.props ?? {}) };
	if (Array.isArray(node.children) && node.children.length > 0) {
		props.children = node.children.length === 1 ? node.children[0] : node.children;
	}
	if (!(type.prototype instanceof ComponentStub)) return expandElement(type(props), depth + 1);
	const instance = new type(props);
	try {
		return expandElement(instance.render(), depth + 1);
	} catch (error) {
		if (typeof type.getDerivedStateFromError !== 'function') throw error;
		instance.state = { ...instance.state, ...type.getDerivedStateFromError(error) };
		if (typeof instance.componentDidCatch === 'function') instance.componentDidCatch(error);
		return expandElement(instance.render(), depth + 1);
	}
}

/**
 * 从根元素展开到宿主元素：座位外层是我们自己的 class 错误边界（SeatBoundary），
 * 内层才是函数组件。断言拿到的仍是完整树，顺带验证"内层抛错会被座位自己兜住，
 * 而不是冒泡出去退役条目"。
 * @param component - bundle 注册的座位组件。
 * @param props - owner 份额 + 注入面。
 * @returns 宿主元素树，或 null。
 */
function renderSeat(component: any, props: any): any {
	return expandElement(component(props));
}

/** 挂载一次座位组件，返回可继续交互的句柄。 */
function mountSeat(harness: Harness, slot = 'conversation.input.model') {
	const entry = harness.registrations.find((item) => item.registration.name === slot);
	if (entry === undefined) throw new Error(`没有注册座位 ${slot}`);
	const face = entry.registration.inject('session-test');
	reactStub.mount();
	const render = () => {
		reactStub.reset();
		return renderSeat(entry.component, { locked: false, ...face });
	};
	return { entry, face, render, tree: render() };
}

function fakePointerEvent(clientX: number) {
	return {
		clientX,
		pointerId: 1,
		button: 0,
		isPrimary: true,
		nativeEvent: {},
		preventDefault: () => {},
		currentTarget: { setPointerCapture: () => {} },
	};
}

function findByRole(tree: any, role: string): FakeElement[] {
	return findAll(tree, (node) => node.props?.role === role);
}
//#endregion

//#region 1. 包清单契约
section('1) package.json 契约');
check('name 是非作用域裸包名', /^[^/@:]+$/.test(manifest.name), manifest.name);
check('exports["./client"] 存在', typeof manifest.exports?.['./client'] === 'string');
check('exports["./package.json"] 存在', manifest.exports?.['./package.json'] === './package.json');
check('客户端 bundle 文件真实存在', existsSync(clientPath), clientPath);
check('dsh.client.platform === "web"', manifest.dsh?.client?.platform === 'web');

// 源码是 TypeScript、产物是 lib/*.js：中间必须有一次构建。缺了这道检查就会出现
// "改完源码、自检全绿、线上跑旧产物"——正是 AGENTS.md 第 2.3 节那类事故的翻版。
const buildManifestPath = join(PACKAGE_ROOT, 'lib/.build-manifest.json');
const buildManifest = existsSync(buildManifestPath)
	? JSON.parse(readFileSync(buildManifestPath, 'utf8'))
	: null;
check('存在构建清单 lib/.build-manifest.json', buildManifest !== null, buildManifestPath);
if (buildManifest !== null) {
	const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
	const stale = [];
	for (const target of buildManifest.targets ?? []) {
		for (const [input, digest] of Object.entries(target.inputs ?? {})) {
			if (!existsSync(join(PACKAGE_ROOT, input)) || sha256(join(PACKAGE_ROOT, input)) !== digest) stale.push(input);
		}
		if (sha256(join(PACKAGE_ROOT, target.output)) !== target.outputSha256) stale.push(target.output);
	}
	check(
		'产物与源码一致（src 改了必须重新 npm run build）',
		stale.length === 0,
		stale.length === 0 ? undefined : `已过期：${stale.join(', ')}`,
	);
	// 上面按 target.inputs 逐项比对，管的是"打包器真的读了的文件"；
	// 这里再比一次整棵 src/ 树，于是**新增文件**和**只影响类型的文件**（model.ts /
	// services.ts / *.d.ts 不会进 bundle）也不会漏掉。
	const sourceFiles = readdirSync(join(PACKAGE_ROOT, 'src'), { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => relative(PACKAGE_ROOT, join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
		.sort();
	const treeParts = sourceFiles.map(
		(file) => `${file}\u0000${createHash('sha256').update(readFileSync(join(PACKAGE_ROOT, file))).digest('hex')}`,
	);
	const treeDigest = createHash('sha256').update(treeParts.join('\n')).digest('hex');
	check('src/ 整棵树与构建清单一致（新增/删除文件也算）', treeDigest === buildManifest.sourceTree, treeDigest);
}
//#endregion

//#region 2. 宿主半边
section('2) 宿主半边 lib/index.js');
const hostModule = await import(pathToFileURL(resolve(PACKAGE_ROOT, manifest.exports['.'])).href);
check('导出了 apply 函数', typeof hostModule.apply === 'function', typeof hostModule.apply);
//#endregion

//#region 3. bundle 协议
section('3) 浏览器半边：模块协议');
const { registration, exports: clientExports } = loadClientBundle();
check('bundle id 等于 package.json 的 name', registration.id === manifest.name, registration.id);
check('bundle 导出 apply 函数', typeof clientExports.apply === 'function', typeof clientExports.apply);
// 运行期只能向平台种子表要模块（打包进去的第三方包不在这个名单里）。
// 这条盯的是"某个依赖被误标成 external"——那种产物在浏览器里会直接 require 失败。
const SEED_SPECIFIERS = [
	'react',
	'react-dom',
	'cordis',
	'dsh-client-store',
	'ui-slots',
	'ui-primitives',
	'ui-dockkit',
	'@deepseek-ai/dsh-client-store',
	'@deepseek-ai/dsh-client-ui-slots',
	'@deepseek-ai/dsh-client-ui-primitives',
	'@deepseek-ai/dsh-client-ui-dockkit',
];
const requireTargets = [...new Set([...clientSource.matchAll(/require\("([^"]+)"\)/g)].map((match) => match[1]))];
check(
	'产物只向平台要种子模块',
	requireTargets.length > 0 && requireTargets.every((target) => SEED_SPECIFIERS.includes(target)),
	requireTargets.join(', '),
);
//#endregion

//#region 4. 座位注册
section('4) 座位注册与注入清单');
const harness = createHarness();
clientExports.apply(harness.ctx);
check('只注册了一个座位', harness.registrations.length === 1, String(harness.registrations.length));
const seat = harness.registrations[0]?.registration;
check('座位是 conversation.input.model', seat?.name === 'conversation.input.model', String(seat?.name));
check('priority === -1（遮蔽官方 priority 0）', seat?.priority === -1, String(seat?.priority));
// 这条是回归护栏：官方 directoryFor() 在调用方上下文里要 this.ctx.remote.session，
// 清单里缺它 = 缓存未命中的会话（切换会话）必炸 "without inject"。
const injectedServices = harness.injected.flat();
for (const required of ['slots', 'modelDirectories', 'sessions', 'remote', 'remote.session']) {
	check(`注入清单含 ${required}`, injectedServices.includes(required), injectedServices.join(', '));
}
check('声明了 inject 面', typeof seat?.inject === 'function');
const face = seat.inject('session-test');
check('inject 工厂只交出 resolve（不在这里解析目录）', typeof face.resolve === 'function' && face.directory === undefined);
const resolvedFace = face.resolve();
check('resolve() 给出 available=true（普通会话）', resolvedFace.available === true, String(resolvedFace.available));
check('resolve() 给出目录对象', resolvedFace.directory === harness.directory);
//#endregion

//#region 4b. 解析失败不许退役条目
section('4b) 目录解析失败（缺注入 / 会话未就绪）');
const coldHarness = createHarness({ directoryThrows: true });
clientExports.apply(coldHarness.ctx);
const coldSeat = coldHarness.registrations[0];
let coldFace;
let injectThrew: unknown = null;
try {
	coldFace = coldSeat.registration.inject('session-cold');
} catch (error) {
	injectThrew = error;
}
check('inject 工厂不抛错（抛错会让 DSH 退役整个条目）', injectThrew === null, String(injectThrew));
let resolveThrew: unknown = null;
try {
	coldFace.resolve();
} catch (error) {
	resolveThrew = error;
}
check(
	'解析失败推迟到渲染期的 resolve()',
	(resolveThrew as Error | null)?.message.includes('without inject') === true,
	String(resolveThrew),
);
reactStub.mount();
consoleErrors.length = 0;
pendingTimers.length = 0;
const coldTree = renderSeat(coldSeat.component, { locked: false, ...coldFace });
check(
	'失败降级成一行可点击重试的提示（条目没被退役）',
	textOf(coldTree).includes('点击重试'),
	textOf(coldTree),
);
check(
	'失败上报到控制台',
	consoleErrors.some((line) => line.includes('dsh-effort-picker')),
	consoleErrors.join(' | '),
);
check('失败后排了自动重试', pendingTimers.length === 1, String(pendingTimers.length));
// 会话就绪后（重新渲染）应当恢复正常控件：不抛错、触发器回来。
const recoveredHarness = createHarness();
clientExports.apply(recoveredHarness.ctx);
const recoveredSeat = recoveredHarness.registrations[0];
reactStub.mount();
const recoveredTree = renderSeat(recoveredSeat.component, {
	locked: false,
	...recoveredSeat.registration.inject('session-test'),
});
check(
	'解析恢复后重新渲染出触发器',
	findAll(recoveredTree, (node) => node.props?.['aria-haspopup'] === 'dialog').length === 1,
);
//#endregion

//#region 5. 子代理会话短路
section('5) 被寻址的子代理会话');
const blocked = createHarness({ available: false });
clientExports.apply(blocked.ctx);
const blockedSeat = blocked.registrations[0];
const blockedFace = blockedSeat.registration.inject('session-test');
const blockedResolved = blockedFace.resolve();
check('available 为 false', blockedResolved.available === false);
reactStub.mount();
const blockedTree = renderSeat(blockedSeat.component, { locked: false, ...blockedFace });
check('不可用时组件返回 null', blockedTree === null, String(blockedTree));
check('不可用时不会触发目录请求', blocked.calls.load === 0, String(blocked.calls.load));
//#endregion

//#region 6. 触发器渲染
section('6) 触发器');
const seatHarness = createHarness();
clientExports.apply(seatHarness.ctx);
const seatHandle = mountSeat(seatHarness);
const triggers = findAll(seatHandle.tree, (node) => node.props?.['aria-haspopup'] === 'dialog');
check('渲染出一个触发器', triggers.length === 1, String(triggers.length));
const triggerText = textOf(triggers[0]);
check('触发器包含模型名', triggerText.includes('deepseek-v4.1-flash'), triggerText);
check('触发器包含档位名', triggerText.includes('Medium'), triggerText);
check('触发器 aria-label 含模型与档位', /推理等级 Medium/.test(triggers[0].props['aria-label']), triggers[0].props['aria-label']);
// 触发器只留 模型名 + 档位 + chevron：那枚前导"数据库"图标按反馈去掉了。
check(
	'触发器不含前导图标（只有 模型名 / 档位 / chevron）',
	triggers[0].children.filter(Boolean).length === 3,
	String(triggers[0].children.length),
);
check('bundle 不再引用 IconDataOutlineRegular', !clientSource.includes('IconDataOutlineRegular'));
// 紧凑模式（composer 把模型名藏起来）时档位必须留下，否则这一格只剩一个 chevron，像坏了。
const effortSpan = findAll(triggers[0], (node) => node.props?.style?.flexShrink === 1000)[0];
check(
	'档位不跟模型名一起藏（紧凑模式也不会只剩 chevron）',
	effortSpan !== undefined && !String(effortSpan.props.style.display).includes('var('),
	String(effortSpan?.props.style.display),
);
// 主次分明：模型名继承触发器的 label-secondary，档位用 label-caption（更浅），
// 不再用 brand 色——否则档位比模型名还抢眼。
check(
	'档位比模型名浅（label-caption，不再是 brand 色）',
	String(effortSpan?.props.style.color).includes('label-caption') &&
		String(triggers[0].props.style.color).includes('label-secondary') &&
		!String(effortSpan?.props.style.color).includes('brand-primary'),
	`effort=${String(effortSpan?.props.style.color)} trigger=${String(triggers[0].props.style.color)}`,
);
check('面板默认关闭', seatHandle.tree.children.includes(null), 'panel 应为 null');
//#endregion

//#region 7. 打开面板：滑杆 ARIA 与停靠点
section('7) 面板与档位滑杆');
seatHandle.tree = (() => {
	triggers[0].props.onClick();
	return seatHandle.render();
})();
check('打开面板触发一次目录 load()', seatHarness.calls.load === 1, String(seatHarness.calls.load));

// 轨道的 DOM 在 EffortTrack 组件内部，所以先找到组件元素、再真正调用它。
const trackElementNode = findAll(
	seatHandle.tree,
	(node) => typeof node.type === 'function' && node.type.name === 'EffortTrack',
)[0];
check('打开后渲染出档位轨道', trackElementNode !== undefined);
const track = trackElementNode.type(trackElementNode.props);
check('轨道 role=slider', track.props.role === 'slider', String(track.props.role));
check('轨道可聚焦（tabIndex=0）', track.props.tabIndex === 0, String(track.props.tabIndex));
check('aria-valuemin=1', track.props['aria-valuemin'] === 1, String(track.props['aria-valuemin']));
check('aria-valuemax=档位数(5)', track.props['aria-valuemax'] === 5, String(track.props['aria-valuemax']));
check('aria-valuenow=3（medium）', track.props['aria-valuenow'] === 3, String(track.props['aria-valuenow']));
check('aria-valuetext=Medium', track.props['aria-valuetext'] === 'Medium', String(track.props['aria-valuetext']));
let positioned = 0;
walk(track, (node) => {
	// 停靠点与滑块都是"left 定位的小圆"（borderRadius 50%）；进度填充是 left:0 + 999px
	// 胶囊圆角，单独断言，不计入这里。
	if (node.props?.style?.left !== undefined && node.props?.style?.borderRadius === '50%') positioned += 1;
});
check('渲染出 5 个停靠点 + 1 个滑块', positioned === 6, String(positioned));
const thumb = track.children[track.children.length - 1];
check('滑块落在中间档位（ratio 0.5）', /0\.5\)$/.test(thumb.props.style.left), String(thumb.props.style.left));
// 进度填充是轨道里的第一个子节点（铺在停靠点与滑块下面）。
const fill = track.children[0];
check('进度填充铺到当前档位（ratio 0.5）', /0\.5\)$/.test(fill.props.style.width), String(fill.props.style.width));
// 形状：轨道与填充都必须是**胶囊**（半径取到半高，左右两端都是半圆），滑块必须是**正圆**。
// 这三条是参考图的硬性形状语言，被单独拎出来断言——历史上就出现过"轨道看着像圆角矩形"的返工，
// 后来在真实 DSH 里又复现：内联的 999px / 50% 被渲染成约 8px 圆角（用户截图实测）。
// 所以现在每一条都是"内联 + 兜底"双保险，缺一半就失败。
const SHAPE_CSS = String(clientExports.SHAPE_CSS);
check(
	'形状兜底样式表给轨道/填充/停靠点/滑块都写了 !important 圆角',
	['track', 'fill', 'tick', 'thumb'].every((name) => SHAPE_CSS.includes(`[data-dsh-effort-picker-${name}]`)) &&
		SHAPE_CSS.includes('border-radius:999px!important') &&
		SHAPE_CSS.includes('border-radius:50%!important'),
	SHAPE_CSS,
);
check(
	'轨道两端是半圆（borderRadius 999px + 兜底样式表命中它）',
	track.props.style.borderRadius === '999px' && track.props['data-dsh-effort-picker-track'] === '',
	`${String(track.props.style.borderRadius)} / ${String(track.props['data-dsh-effort-picker-track'])}`,
);
check(
	'进度填充两端也是半圆（borderRadius + clip-path 双保险）',
	fill.props.style.borderRadius === '999px' && String(fill.props.style.clipPath).includes('round'),
	`${String(fill.props.style.borderRadius)} / ${String(fill.props.style.clipPath)}`,
);
check(
	'滑块是正圆（宽高相等 + borderRadius 50% + clip-path circle）',
	thumb.props.style.width === '25px' &&
		thumb.props.style.height === '25px' &&
		thumb.props.style.borderRadius === '50%' &&
		thumb.props.style.clipPath === 'circle(50%)' &&
		thumb.props['data-dsh-effort-picker-thumb'] === '',
	`${String(thumb.props.style.width)}/${String(thumb.props.style.height)}/${String(thumb.props.style.borderRadius)}/${String(thumb.props.style.clipPath)}`,
);
const trackHeightPx = Number(String(track.props.style.height).replace('px', ''));
check(
	'轨道 22px < 滑块直径 25px（圆钮略微探出轨道上下沿）',
	trackHeightPx === 22 && trackHeightPx < Number(String(thumb.props.style.width).replace('px', '')),
	String(track.props.style.height),
);
// 标题区改成"档位名居中 + 模型名居中带 ›"（参考 Codex 的档位面板），
// 原来左侧的"推理等级"说明行与面板底部那一行模型已合并到这里。
const headerTitle = findAll(
	seatHandle.tree,
	(node) => node.props?.style?.textAlign === 'center' && String(node.props?.style?.color).includes('brand-primary'),
)[0];
check(
	'面板标题居中显示当前档位',
	headerTitle !== undefined && textOf(headerTitle) === 'Medium',
	textOf(seatHandle.tree),
);
check(
	'标题下方的模型行是唯一的下钻入口',
	findAll(seatHandle.tree, (node) => node.type === 'button' && node.props?.['aria-haspopup'] === 'menu').length === 1,
);
// 主题适配的三条护栏：菜单面是半透明材质，裸用 bg-layer-2 时轨道会与面板同色
// （深色主题 #43454a73 换算出来≈#2c2c2e；浅色主题两者都接近白），所以轨道必须掺一档
// label-primary；浅色主题里白圆钮靠描边、白点靠掺 label-primary 变浅灰点，才不会消失。
check(
	'轨道底色掺了 label-primary（两种主题下都与面板差一档）',
	/color-mix\(in srgb, var\(--dsw-alias-label-primary\)/.test(String(track.props.style.backgroundColor)),
	String(track.props.style.backgroundColor),
);
check(
	'滑块带描边 + 投影（浅色主题下也能看出边界）',
	String(thumb.props.style.boxShadow).includes('rgba(0, 0, 0'),
	String(thumb.props.style.boxShadow),
);
const tickNode = findAll(track, (node) => node.props?.style?.width === '4px')[0];
check(
	'停靠点掺了 label-primary（浅色主题下变浅灰点，而不是彻底消失的裸白点）',
	String(tickNode?.props.style.background).includes('--dsw-alias-label-primary'),
	String(tickNode?.props.style.background),
);
check(
	'停靠点也是圆的（clip-path circle + 兜底样式表，宿主改圆角也压不方）',
	tickNode?.props.style.clipPath === 'circle(50%)' && tickNode?.props['data-dsh-effort-picker-tick'] === '',
	String(tickNode?.props.style.clipPath),
);
//#endregion

//#region 8. 拖拽提交：一次手势只提交一次
section('8) 拖拽提交');
const dragHarness = createHarness();
clientExports.apply(dragHarness.ctx);
const dragSeat = mountSeat(dragHarness);
findAll(dragSeat.tree, (node) => node.props?.['aria-haspopup'] === 'dialog')[0].props.onClick();
dragSeat.tree = dragSeat.render();
const dragTrackNode = findAll(dragSeat.tree, (node) => typeof node.type === 'function' && node.type.name === 'EffortTrack')[0];
dragTrackNode.type(dragTrackNode.props); // 挂载轨道：给 trackRef 一个假节点
dragTrackNode.props.onPointerDown(fakePointerEvent(200)); // 最右端 → 最后一档
check('按下时还不提交', dragHarness.calls.select.length === 0, String(dragHarness.calls.select.length));
dragSeat.tree = dragSeat.render(); // 重渲染，让 pointerup 拿到新的 draftIndex
const dragTrackNode2 = findAll(dragSeat.tree, (node) => typeof node.type === 'function' && node.type.name === 'EffortTrack')[0];
const draftThumb = dragTrackNode2.type(dragTrackNode2.props).children.at(-1);
check('拖拽预览把滑块移到最右档（ratio 1）', /1\)$/.test(draftThumb.props.style.left), String(draftThumb.props.style.left));
dragTrackNode2.props.onPointerUp(fakePointerEvent(200));
check('松手提交一次', dragHarness.calls.select.length === 1, String(dragHarness.calls.select.length));
check(
	'提交的是最后一档 max',
	dragHarness.calls.select[0]?.reasoningEffort === 'max',
	JSON.stringify(dragHarness.calls.select[0]),
);
//#endregion

//#region 8b. 连续跟手：拖动中滑块不跳档，松手才吸附到最近档
section('8b) 连续跟手');
const followHarness = createHarness();
clientExports.apply(followHarness.ctx);
const followSeat = mountSeat(followHarness);
const findTrack = (tree: any) =>
	findAll(tree, (node) => typeof node.type === 'function' && node.type.name === 'EffortTrack')[0];
findAll(followSeat.tree, (node) => node.props?.['aria-haspopup'] === 'dialog')[0].props.onClick();
const followNode = findTrack(followSeat.render());
followNode.type(followNode.props); // 挂载轨道 → trackRef/thumbRef 指向假节点
followNode.props.onPointerDown(fakePointerEvent(100)); // 正中间 → ratio 0.5
const followStart = findTrack(followSeat.render());
const followStartThumb = followStart.type(followStart.props).children.at(-1);
check('按下落在中点时滑块在 ratio 0.5', /0\.5\)$/.test(followStartThumb.props.style.left), String(followStartThumb.props.style.left));
followStart.props.onPointerMove(fakePointerEvent(130)); // ratio ≈ 0.6596，不是任何停靠点
check('拖动中始终不提交', followHarness.calls.select.length === 0, String(followHarness.calls.select.length));
const followTree = followSeat.render();
const followTrackElement = findTrack(followTree);
const followThumb = followTrackElement.type(followTrackElement.props).children.at(-1);
const multiplier = /\* ([\d.]+)\)$/.exec(followThumb.props.style.left)?.[1];
check(
	'滑块停在连续位置（不是任何档位）',
	multiplier !== undefined && !['0', '0.25', '0.5', '0.75', '1'].includes(multiplier),
	String(followThumb.props.style.left),
);
// 填充与滑块用同一个 centerAt(ratio)：宽度必须等于滑块的 left，否则进度条会与圆钮错位。
const followFill = followTrackElement.type(followTrackElement.props).children[0];
check(
	'进度填充与滑块同一位置（同一个 centerAt）',
	followFill.props.style.width === followThumb.props.style.left,
	`fill=${String(followFill.props.style.width)} thumb=${String(followThumb.props.style.left)}`,
);
check(
	'拖动中填充也关掉 transition（否则拖在手速后面）',
	followFill.props.style.transition === 'none',
	String(followFill.props.style.transition),
);
check('面板标题跟随最近的档位 High', textOf(followTree).includes('High'), textOf(followTree));
// 触发器在面板**外面**：它必须只显示已提交档位。跟手变的话，下方控件会在
// Low/Medium/High 之间来回跳、宽度也跟着抖——反馈里明确点过这条。
const followTrigger = findAll(followTree, (node) => node.props?.['aria-haspopup'] === 'dialog')[0];
check(
	'拖动中触发器文案不跟手跳（仍是已提交的 Medium）',
	textOf(followTrigger).includes('Medium') && !textOf(followTrigger).includes('High'),
	textOf(followTrigger),
);
const followTrackElement2 = findTrack(followTree);
followTrackElement2.props.onPointerUp(fakePointerEvent(130));
check(
	'松手吸附并提交 High',
	followHarness.calls.select[0]?.reasoningEffort === 'high',
	JSON.stringify(followHarness.calls.select[0]),
);
//#endregion

//#region 8c. 档位没设置时滑块也必须有滑块头
section('8c) 未显式设置档位');
// 会话档位被清空（官方 `/model` 切换、或历史上被不带档位的选择清过）+ 该模型**没有**路由默认档
// → 旧实现 `activeIndex = -1` → thumb / fill 都不渲染，用户看到一条没有滑块头的轨道。
const unsetSnapshot = {
	...SNAPSHOT,
	current: { provider: 'cpa', model: 'cn:glm-5.3-flash' },
};
const unsetHarness = createHarness({ snapshot: unsetSnapshot });
clientExports.apply(unsetHarness.ctx);
const unsetSeat = mountSeat(unsetHarness);
const unsetTrigger = findAll(unsetSeat.tree, (node) => node.props?.['aria-haspopup'] === 'dialog')[0];
check(
	'未显式设置档位时触发器显示「最高档（默认）」而不是「默认」',
	textOf(unsetTrigger).includes('Max（默认）'),
	textOf(unsetTrigger),
);
unsetTrigger.props.onClick();
const unsetTree = unsetSeat.render();
const unsetTrackNode = findTrack(unsetTree);
check('未显式设置档位时轨道仍然渲染', unsetTrackNode !== undefined);
// 断言不许在缺节点时抛 TypeError：那样整份自检会**崩掉**，后面的用例一条都跑不到
// （旧实现里 thumb/fill 都是 null，第一版就是这么崩掉的）。
const unsetTrack = unsetTrackNode === undefined ? undefined : unsetTrackNode.type(unsetTrackNode.props);
const unsetThumb = unsetTrack === undefined ? undefined : unsetTrack.children.at(-1);
const unsetFill = unsetTrack === undefined ? undefined : unsetTrack.children[0];
const hasThumb = unsetThumb !== null && unsetThumb !== undefined;
check('轨道上仍有滑块头（旧实现这里是 null → 看起来就是"滑块不行"）', hasThumb, String(unsetThumb));
check(
	'滑块头落在最高档（ratio 1）',
	hasThumb && /1\)$/.test(unsetThumb.props.style.left),
	String(unsetThumb?.props.style.left),
);
check(
	'进度填充同样铺到最高档（不会与滑块头错位）',
	hasThumb && unsetFill !== null && unsetFill !== undefined && unsetFill.props.style.width === unsetThumb.props.style.left,
	`fill=${String(unsetFill?.props.style.width)} thumb=${String(unsetThumb?.props.style.left)}`,
);
// 面板标题同样带「默认」后缀，不把兜底位置说成用户选过的档位。
check('面板标题显示「Max（默认）」', textOf(unsetTree).includes('Max（默认）'), textOf(unsetTree));
//#endregion

//#region 9. 键盘调档
section('9) 键盘调档');
const keyHarness = createHarness();
clientExports.apply(keyHarness.ctx);
const keySeat = mountSeat(keyHarness);
const keyRoot = keySeat.tree;
findAll(keyRoot, (node) => node.props?.['aria-haspopup'] === 'dialog')[0].props.onClick();
const keyTree = keySeat.render();
const rootDiv = findAll(keyTree, (node) => typeof node.props?.onKeyDown === 'function' && node.props?.style?.display === 'contents')[0];
check('根节点挂了键盘处理', rootDiv !== undefined);
rootDiv.props.onKeyDown({ key: 'ArrowRight', nativeEvent: {}, preventDefault: () => {} });
check('ArrowRight 升一档 → high', keyHarness.calls.select[0]?.reasoningEffort === 'high', JSON.stringify(keyHarness.calls.select[0]));
keyHarness.calls.select.length = 0;
rootDiv.props.onKeyDown({ key: 'Home', nativeEvent: {}, preventDefault: () => {} });
check('Home 跳到最低档 → off', keyHarness.calls.select[0]?.reasoningEffort === 'off', JSON.stringify(keyHarness.calls.select[0]));
keyHarness.calls.select.length = 0;
rootDiv.props.onKeyDown({ key: 'Escape', nativeEvent: {}, preventDefault: () => {} });
check('Escape 不提交任何选择', keyHarness.calls.select.length === 0, String(keyHarness.calls.select.length));
//#endregion

//#region 10. 模型下钻
section('10) 模型下钻');
const modelHarness = createHarness();
clientExports.apply(modelHarness.ctx);
const modelSeat = mountSeat(modelHarness);
findAll(modelSeat.tree, (node) => node.props?.['aria-haspopup'] === 'dialog')[0].props.onClick();
let modelTree = modelSeat.render();
const modelLine = findAll(
	modelTree,
	(node) => node.type === 'button' && node.props?.['aria-haspopup'] === 'menu',
)[0];
check('标题下方有"模型"下钻入口', modelLine !== undefined);
check('该入口显示当前模型', textOf(modelLine).includes('deepseek-v4.1-flash'), textOf(modelLine));
modelLine.props.onClick();
modelTree = modelSeat.render();
const modelRows = findByRole(modelTree, 'menuitemradio');
check('模型列表渲染出 4 个模型（两个 provider）', modelRows.length === 4, String(modelRows.length));
check('当前模型被标记为选中', modelRows[0].props.checked === true, String(modelRows[0].props.checked));
// 列表**按 provider 分组**：每组一行可见组名。用户配置的第三方路由（cpa / huawei …）
// 与官方 provider 的模型混在同一个列表里，只靠 aria-label 的时候肉眼分不出谁家的
// （实测反馈：分组要加回来）。分组必须是**结构性**的——模型行装在组里，不是随便多印一行字。
const groupNodes = findAll(modelTree, (node) => node.props?.role === 'group');
check('列表按 provider 分组：两个有模型的 provider 各一组', groupNodes.length === 2, String(groupNodes.length));
check(
	'组名用 provider 的 name（缺省回落到 id）',
	groupNodes.map((group) => String(group.props['aria-label'])).join(' | ') === 'cpa | DeepSeek 官方',
	groupNodes.map((group) => String(group.props['aria-label'])).join(' | '),
);
const rowsIn = (group: FakeElement): FakeElement[] =>
	findAll(group, (node) => node.props?.role === 'menuitemradio');
check('第一个组里正好 3 个模型行', rowsIn(groupNodes[0]).length === 3, String(rowsIn(groupNodes[0]).length));
check('第二个组里正好 1 个模型行', rowsIn(groupNodes[1]).length === 1, String(rowsIn(groupNodes[1]).length));
check(
	'没有模型的 provider 不渲染空组名',
	!textOf(modelTree).includes('未使用的路由'),
	textOf(modelTree),
);
// 组名是标题行，不是可选行：不能是 button，也不能带 menuitemradio。
check(
	'组名只是标题、不是可选行',
	groupNodes.every((group) => group.type === 'div' && group.props.role !== 'menuitemradio'),
	String(groupNodes.map((group) => String(group.type)).join(' | ')),
);
// 组名可见（视觉上真印出来），但比模型行浅：label-secondary ↔ 模型行 label-primary。
// 组名那一行里还有两个 aria-hidden 的元素：右侧 1px 分隔线与组内模型数。
const groupHiddenNodes = (group: FakeElement): FakeElement[] =>
	findAll(group, (node) => node.props?.['aria-hidden'] === 'true');
const groupLabelText = (group: FakeElement): string => textOf(groupHiddenNodes(group)[0] ?? null);
const groupCountText = (group: FakeElement): string =>
	groupHiddenNodes(group)
		.slice(1)
		.map((node) => textOf(node))
		.join('');
check('第一个组的组名印出来了（cpa）', groupLabelText(groupNodes[0]) === 'cpa', groupLabelText(groupNodes[0]));
check(
	'第二个组的组名印出来了（DeepSeek 官方）',
	groupLabelText(groupNodes[1]) === 'DeepSeek 官方',
	groupLabelText(groupNodes[1]),
);
const groupLabelStyle = /groupLabelText:\s*\{([^{}]*)\}/.exec(clientSource)?.[1] ?? '';
check(
	'组名用 label-secondary（比模型行浅一档）且加粗',
	groupLabelStyle.includes('label-secondary') && groupLabelStyle.includes('fontWeight: 600'),
	groupLabelStyle.replace(/\s+/g, ' ').trim(),
);
// 只有一行浅色小字时三组会连成一片（实测反馈：分组不明显），所以组名右侧还要有分隔线。
const groupRuleStyle = /groupRule:\s*\{([^{}]*)\}/.exec(clientSource)?.[1] ?? '';
check(
	'组名右侧有 1px 分隔线（掺 label-primary）',
	groupRuleStyle.includes('1px') && groupRuleStyle.includes('label-primary'),
	groupRuleStyle.replace(/\s+/g, ' ').trim(),
);
// 组内模型数：两组都必须等于组里的行数，不能写死。
check(
	'每组组名末尾显示组内模型数（与行数一致）',
	groupCountText(groupNodes[0]) === String(rowsIn(groupNodes[0]).length) &&
		groupCountText(groupNodes[1]) === String(rowsIn(groupNodes[1]).length),
	`${groupCountText(groupNodes[0])}/${String(rowsIn(groupNodes[0]).length)} | ${groupCountText(groupNodes[1])}/${String(rowsIn(groupNodes[1]).length)}`,
);
// 组名只做分隔，不做卡片：组容器没有边框、没有底色、没有圆角。
const groupStyle = /(?<![A-Za-z])group:\s*\{([^{}]*)\}/.exec(clientSource)?.[1] ?? '';
check(
	'组容器不是卡片（无 border / 底色 / 圆角）',
	groupStyle.includes('flexDirection') && !/(border|background|borderRadius)/.test(groupStyle),
	groupStyle.replace(/\s+/g, ' ').trim(),
);
const rowLabels = modelRows.map((row) => String(row.props.ariaLabel));
check(
	'每行的 aria-label 仍带上自己的 provider',
	rowLabels[0].includes('cpa') &&
		rowLabels[1].includes('cpa') &&
		rowLabels[2].includes('cpa') &&
		rowLabels[3].includes('DeepSeek 官方'),
	rowLabels.join(' | '),
);
// 模型行主文字仍是 label-primary（来自 bundle 源码里的 rowButton）。
const rowButtonColor = /rowButton:\s*\{[\s\S]*?color:\s*"([^"]+)"/.exec(clientSource)?.[1] ?? '';
check('模型行文字用 label-primary', rowButtonColor.includes('label-primary'), rowButtonColor);
// 选中标记在行尾：当前行有勾，其它行没有（平铺后它是唯一的"我在哪"信号）。
const checkIconCount = (row: FakeElement): number =>
	findAll(row, (node) => node.type === primitivesStub.IconCheckOutlineRegular).length;
check('当前行行尾有勾选图标', checkIconCount(modelRows[0]) === 1, String(checkIconCount(modelRows[0])));
check('非当前行没有勾选图标', checkIconCount(modelRows[1]) === 0, String(checkIconCount(modelRows[1])));
check('当前模型行显示当前档位 Medium', textOf(modelRows[0]).includes('Medium'), textOf(modelRows[0]));
// 非当前模型行显示的是"选中它会带上的那一档" = 该模型的**最高档**。
// glm-5.3 的路由默认档是 low，但最高档是 High —— 行里必须显示 High（旧实现显示路由默认的 Low）。
check(
	'其它模型行显示选中它会带上的档位（最高档 High，不是路由默认的 Low）',
	textOf(modelRows[1]).includes('High') && !textOf(modelRows[1]).includes('Low'),
	textOf(modelRows[1]),
);
modelRows[1].props.onClick();
check('选模型提交 provider', modelHarness.calls.select[0]?.provider === 'cpa', JSON.stringify(modelHarness.calls.select[0]));
check('选模型提交该模型 id', modelHarness.calls.select[0]?.model === 'cn:glm-5.3', JSON.stringify(modelHarness.calls.select[0]));
check(
	'选模型带上该模型的最高档（high），不是路由默认档（low）',
	modelHarness.calls.select[0]?.reasoningEffort === 'high',
	JSON.stringify(modelHarness.calls.select[0]),
);
// 回归护栏：模型**没有** defaultEffort 时也必须显式带上最高档。
// 旧实现这里会省略 reasoningEffort → 会话档位被清空 → 选择器没有滑块头（实测反馈的根因）。
modelRows[2].props.onClick();
check(
	'没有路由默认档的模型也要带上最高档（max），绝不能省略档位',
	modelHarness.calls.select[1]?.reasoningEffort === 'max',
	JSON.stringify(modelHarness.calls.select[1]),
);
check('并且确实提交了 model id', modelHarness.calls.select[1]?.model === 'cn:glm-5.3-flash', JSON.stringify(modelHarness.calls.select[1]));
// 跨组选择：点第二个 provider 的模型，提交的是**它自己的** provider。分组只是视觉分隔，
// 不能把组里的行搞混成"都按第一组的 provider 提交"。
modelRows[3].props.onClick();
check(
	'跨组选模型提交对应的 provider',
	modelHarness.calls.select[2]?.provider === 'deepseek',
	JSON.stringify(modelHarness.calls.select[2]),
);
check(
	'跨组选模型提交该模型 id',
	modelHarness.calls.select[2]?.model === 'deepseek-chat',
	JSON.stringify(modelHarness.calls.select[2]),
);
//#endregion

//#region 11. 失败提示
section('11) 提交失败');
const failHarness = createHarness({
	selectOutcome: { ok: false, error: { code: 'session/writer-held', message: 'held' } },
});
clientExports.apply(failHarness.ctx);
const failSeat = mountSeat(failHarness);
findAll(failSeat.tree, (node) => node.props?.['aria-haspopup'] === 'dialog')[0].props.onClick();
const failTree = failSeat.render();
const failTrackNode = findAll(failTree, (node) => typeof node.type === 'function' && node.type.name === 'EffortTrack')[0];
failTrackNode.type(failTrackNode.props);
failTrackNode.props.onPointerDown(fakePointerEvent(0));
failSeat.render();
const failTrackNode2 = findAll(failSeat.render(), (node) => typeof node.type === 'function' && node.type.name === 'EffortTrack')[0];
failTrackNode2.props.onPointerUp(fakePointerEvent(0));
check('失败路径确实提交了选择', failHarness.calls.select.length === 1, String(failHarness.calls.select.length));
await new Promise((resolve) => setTimeout(resolve, 0));
const afterFail = failSeat.render();
check(
	'失败后面板仍打开（轨道还在）',
	findAll(afterFail, (node) => typeof node.type === 'function' && node.type.name === 'EffortTrack').length === 1,
);
check('显示出会话占用提示', textOf(afterFail).includes('另一个 DSH 实例'), textOf(afterFail));
//#endregion

//#region 11b. 面板落位
// 面板是挂在 body 上的 fixed 浮层，位置只能自己算。打开的第一帧用纯函数估算
// （`placement.ts` 的 `estimatePanelPosition`），之后由 floating-ui 的 autoUpdate 跟随。
// 这里只测纯函数——它是"打开瞬间不跳位 / 贴边不越界"的全部逻辑。
section('11b) 面板落位（打开瞬间的同步估算）');
const estimate = clientExports.estimatePanelPosition;
check('bundle 导出落位估算函数', typeof estimate === 'function', typeof estimate);
if (typeof estimate === 'function') {
	const size = { width: 224, height: 200 };
	const viewport = { width: 1280, height: 800 };
	const normal = estimate({ top: 700, bottom: 728, left: 100, right: 300 }, size, viewport);
	check('默认贴着触发器上方、右对齐', normal.top === 492 && normal.left === 76, JSON.stringify(normal));
	const flipped = estimate({ top: 40, bottom: 68, left: 100, right: 300 }, size, viewport);
	check('上方放不下时翻到下方（不盖住触发器、不越出下沿）', flipped.top === 76, JSON.stringify(flipped));
	const farRight = estimate({ top: 700, bottom: 728, left: 1100, right: 1270 }, size, viewport);
	check('右边缘不越界', farRight.left === 1044, JSON.stringify(farRight));
	const farLeft = estimate({ top: 700, bottom: 728, left: 0, right: 40 }, size, viewport);
	check('左边缘不越界', farLeft.left === 12, JSON.stringify(farLeft));
}
//#endregion

//#region 12. 接线形态
const args = process.argv.slice(2);
const patchArg = args[args.indexOf('--patch') + 1];
const yamlArg = args[args.indexOf('--yaml') + 1];

// 形态一（推荐）：本仓库自己就是 bundle —— 自带补丁层，安装时由安装器写 profile。
section('12) 接线：bundle 自带补丁层 cordis.patch.yml');
const bundlePatchPath = join(PACKAGE_ROOT, 'cordis.patch.yml');
check(
	'package.json 声明 dsh.bundle.patch',
	manifest.dsh?.bundle?.patch === './cordis.patch.yml',
	String(manifest.dsh?.bundle?.patch),
);
check('补丁层文件存在', existsSync(bundlePatchPath), bundlePatchPath);
const bundlePatchText = existsSync(bundlePatchPath) ? readFileSync(bundlePatchPath, 'utf8') : '';
check(
	'补丁层在 insert 下写了本插件的条目（id / name 都等于包名）',
	new RegExp(`- insert:[\\s\\S]*id: ${manifest.name}[\\s\\S]*name: '?${manifest.name}'?`).test(bundlePatchText),
	bundlePatchText.trim().split('\n').slice(-2).join(' | '),
);

// 形态二：老办法 —— profile 的补丁层里手写一行（`--patch <profile 的 cordis.patch.yml>`）。
// 两种形态都合法；只要有**一种**成立就算接线完整，都没有则失败（表现是"装了却没生效"）。
if (!args.includes('--patch')) {
	section('12b) profile 接线 —— 跳过（未传 --patch）');
} else {
	section('12b) profile 接线（手写 insert 行 或 bundle 安装）');
	const patchPath =
		patchArg === undefined ? '' : isAbsolute(patchArg) ? patchArg : resolve(process.cwd(), patchArg);
	check('patch 文件存在', existsSync(patchPath), patchPath);
	const text = existsSync(patchPath) ? readFileSync(patchPath, 'utf8') : '';
	const pathForm = `file:///${resolve(PACKAGE_ROOT, manifest.exports['.']).replaceAll('\\', '/')}`;
	const manualRow =
		text.includes(pathForm) ||
		new RegExp(`id:\\s*${manifest.name}[\\s\\S]{0,200}?name:\\s*['"]?${manifest.name}['"]?`).test(text);
	const profilePackagePath = join(dirname(patchPath), 'package.json');
	const profileBundles: string[] = existsSync(profilePackagePath)
		? (JSON.parse(readFileSync(profilePackagePath, 'utf8')).dsh?.profile?.bundles ?? [])
		: [];
	const installedAsBundle = profileBundles.includes(manifest.name);
	check(
		'profile 已接线（手写 insert 行，或把本包列进 dsh.profile.bundles）',
		manualRow || installedAsBundle,
		`手写行=${String(manualRow)} bundle=${String(installedAsBundle)}`,
	);
	if (args.includes('--yaml')) {
		const yamlModule = await import(pathToFileURL(resolve(yamlArg, 'dist/index.js')).href);
		const parsed = yamlModule.parse(text);
		check('profile patch 顶层是数组', Array.isArray(parsed), typeof parsed);
	} else {
		console.log('  --   跳过 YAML 解析（未传 --yaml <yaml 包目录>）');
	}
}
//#endregion

console.log('');
for (const note of notes) console.log(`note: ${note}`);
if (failures.length === 0) {
	console.log('全部通过 ✓');
	process.exit(0);
}
console.log(`失败 ${failures.length} 项：`);
for (const failure of failures) console.log(`  - ${failure}`);
process.exit(1);
