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
 * 用法：
 *   node tools/verify.mjs
 *   node tools/verify.mjs --patch "C:\Users\admin\.dsh\profiles\desktop\cordis.patch.yml"
 *   node tools/verify.mjs --patch <...> --yaml <yaml 包目录>
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const failures = [];
const notes = [];
function check(label, condition, detail) {
	if (condition) {
		console.log(`  ok   ${label}`);
		return true;
	}
	failures.push(`${label}${detail === undefined ? '' : ` — ${detail}`}`);
	console.log(`  FAIL ${label}${detail === undefined ? '' : ` — ${detail}`}`);
	return false;
}
function section(title) {
	console.log(title);
}

//#region 极简 React / DOM 替身
/**
 * 极简 class 组件基类：只实现 `state` / `setState`，刚好够跑错误边界协议
 * （`getDerivedStateFromError` + `componentDidCatch`）。
 */
class ComponentStub {
	constructor(props) {
		this.props = props ?? {};
		this.state = this.state ?? {};
	}

	setState(next) {
		this.state = { ...this.state, ...(typeof next === 'function' ? next(this.state) : next) };
	}
}

/** 让 useState 真正保存状态、useRef 真正持有对象，从而能观察交互后的重渲染。 */
function createReactStub() {
	const state = [];
	let cursor = 0;
	const react = {
		Component: ComponentStub,
		reset() {
			cursor = 0;
		},
		mount() {
			state.length = 0;
			cursor = 0;
		},
		useState(initial) {
			const slot = cursor;
			cursor += 1;
			if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial;
			return [
				state[slot],
				(next) => {
					state[slot] = typeof next === 'function' ? next(state[slot]) : next;
				},
			];
		},
		useRef(initial) {
			const slot = cursor;
			cursor += 1;
			if (!(slot in state)) state[slot] = { current: initial };
			return state[slot];
		},
		useEffect() {},
		useLayoutEffect() {},
		useSyncExternalStore(_subscribe, getSnapshot) {
			return getSnapshot();
		},
		createElement(type, props, ...children) {
			const { ref, ...rest } = props ?? {};
			if (ref !== undefined && typeof ref === 'object' && ref !== null && 'current' in ref) {
				ref.current = createFakeNode(type);
			}
			return { type, props: rest, children };
		},
	};
	return react;
}

function createFakeNode(tag) {
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
function createPrimitivesStub(react) {
	const icon = (name) => (props) => react.createElement('span', { 'data-icon': name, style: props?.style });
	return {
		MenuSurface: (props) => react.createElement('div', { 'data-surface': 'menu', style: props?.style }, props?.children),
		IconDataOutlineRegular: icon('data'),
		IconChevronDownOutlineRegular: icon('chevron-down'),
		IconChevronRightOutlineRegular: icon('chevron-right'),
		IconChevronLeftOutlineRegular: icon('chevron-left'),
		IconCheckOutlineRegular: icon('check'),
		StateDot: (props) => react.createElement('span', { 'data-state': props?.state }),
	};
}

/** 遍历元素树。 */
function walk(node, visit) {
	if (node === null || node === undefined || typeof node === 'boolean') return;
	if (Array.isArray(node)) {
		for (const child of node) walk(child, visit);
		return;
	}
	if (typeof node !== 'object') return;
	visit(node);
	for (const child of node.children ?? []) walk(child, visit);
}

function findAll(tree, predicate) {
	const out = [];
	walk(tree, (node) => {
		if (predicate(node)) out.push(node);
	});
	return out;
}

function textOf(tree) {
	let text = '';
	walk(tree, (node) => {
		for (const child of node.children ?? []) if (typeof child === 'string') text += child;
	});
	return text;
}
//#endregion

//#region 载入 bundle
const manifest = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));
const clientPath = resolve(PACKAGE_ROOT, manifest.exports['./client']);
const clientSource = readFileSync(clientPath, 'utf8');
const reactStub = createReactStub();
const primitivesStub = createPrimitivesStub(reactStub);
const reactDomStub = { createPortal: (element) => element };
/** 沙箱 console 替身：记录上报内容，供"失败必须被上报"的断言使用。 */
const consoleErrors = [];
/** 沙箱定时器替身：只记录被排期的回调（边界自动重试是 150ms 级，测试里不真的跑）。 */
const pendingTimers = [];

function loadClientBundle() {
	let captured;
	const sandbox = {
		console: {
			error: (...parts) => consoleErrors.push(parts.map((part) => String(part)).join(' ')),
			warn: () => {},
			log: () => {},
		},
		setTimeout: (fn) => {
			pendingTimers.push(fn);
			return pendingTimers.length;
		},
		clearTimeout: () => {},
		window: {
			__ModuleLoader__: {
				load(registration) {
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
		},
		Element: class Element {},
		queueMicrotask: (fn) => fn(),
	};
	vm.runInNewContext(clientSource, sandbox, { filename: 'lib/client.js' });
	if (captured === undefined) throw new Error('bundle 没有调用 window.__ModuleLoader__.load');
	const exports = captured.factory((specifier) => {
		if (specifier === 'react') return reactStub;
		if (specifier === 'react-dom') return reactDomStub;
		if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return primitivesStub;
		throw new Error(`bundle 请求了未播种的模块：${specifier}`);
	});
	return { registration: captured, exports };
}

//#endregion

//#region 假 ctx / 假目录服务
const EFFORT_LEVELS = ['off', 'low', 'medium', 'high', 'max'].map((id) => ({
	id,
	name: `${id.charAt(0).toUpperCase()}${id.slice(1)}`,
}));
const GROUPS = [
	{
		id: 'cpa',
		name: 'cpa',
		models: [
			{
				id: 'cn:deepseek-v4.1-flash',
				name: 'deepseek-v4.1-flash',
				reasoning: { efforts: EFFORT_LEVELS, defaultEffort: 'max' },
			},
			{ id: 'cn:glm-5.3', name: 'glm-5.3', reasoning: { efforts: EFFORT_LEVELS.slice(1, 4), defaultEffort: 'high' } },
		],
	},
];
const SNAPSHOT = {
	status: 'ready',
	current: { provider: 'cpa', model: 'cn:deepseek-v4.1-flash', reasoningEffort: 'medium' },
	retainedEffort: undefined,
	routable: true,
	groups: GROUPS,
	failures: [],
	pending: null,
	error: null,
};

/**
 * 搭一个可观察的宿主环境。
 * @param options - available / selectOutcome / snapshot / directoryThrows。
 */
function createHarness(options = {}) {
	const calls = { load: 0, select: [] };
	const directory = {
		store: {
			getSnapshot: () => options.snapshot ?? SNAPSHOT,
			subscribe: () => () => {},
		},
		load: async () => {
			calls.load += 1;
			return options.snapshot ?? SNAPSHOT;
		},
		select: async (selection) => {
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

	const registrations = [];
	const injected = [];
	const ctx = {
		inject(services, callback) {
			injected.push(services);
			const scope = {
				modelDirectories,
				sessions: { subagentAddress },
				slots: {
					inject(key, cb) {
						scope.slots.key = key;
						return cb();
					},
					register(registration, component) {
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
function expandElement(node, depth = 0) {
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
function renderSeat(component, props) {
	return expandElement(component(props));
}

/** 挂载一次座位组件，返回可继续交互的句柄。 */
function mountSeat(harness, slot = 'conversation.input.model') {
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

function fakePointerEvent(clientX) {
	return {
		clientX,
		pointerId: 1,
		nativeEvent: {},
		preventDefault: () => {},
		currentTarget: { setPointerCapture: () => {} },
	};
}

function findByRole(tree, role) {
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
let injectThrew = null;
try {
	coldFace = coldSeat.registration.inject('session-cold');
} catch (error) {
	injectThrew = error;
}
check('inject 工厂不抛错（抛错会让 DSH 退役整个条目）', injectThrew === null, String(injectThrew));
let resolveThrew = null;
try {
	coldFace.resolve();
} catch (error) {
	resolveThrew = error;
}
check(
	'解析失败推迟到渲染期的 resolve()',
	resolveThrew?.message.includes('without inject') === true,
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
const findTrack = (tree) =>
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
const followTrackElement2 = findTrack(followTree);
followTrackElement2.props.onPointerUp(fakePointerEvent(130));
check(
	'松手吸附并提交 High',
	followHarness.calls.select[0]?.reasoningEffort === 'high',
	JSON.stringify(followHarness.calls.select[0]),
);
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
check('模型列表渲染出 2 个模型', modelRows.length === 2, String(modelRows.length));
check('当前模型被标记为选中', modelRows[0].props.checked === true, String(modelRows[0].props.checked));
check('模型列表按 provider 分组显示标题', textOf(modelTree).includes('cpa'), textOf(modelTree));
check('当前模型行显示当前档位 Medium', textOf(modelRows[0]).includes('Medium'), textOf(modelRows[0]));
check('其它模型行显示其默认档位 High', textOf(modelRows[1]).includes('High'), textOf(modelRows[1]));
modelRows[1].props.onClick();
check('选模型提交 provider', modelHarness.calls.select[0]?.provider === 'cpa', JSON.stringify(modelHarness.calls.select[0]));
check('选模型提交该模型 id', modelHarness.calls.select[0]?.model === 'cn:glm-5.3', JSON.stringify(modelHarness.calls.select[0]));
check(
	'选模型带上该模型默认档位（high）',
	modelHarness.calls.select[0]?.reasoningEffort === 'high',
	JSON.stringify(modelHarness.calls.select[0]),
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

//#region 12. profile 接线
const args = process.argv.slice(2);
const patchArg = args[args.indexOf('--patch') + 1];
const yamlArg = args[args.indexOf('--yaml') + 1];
if (!args.includes('--patch')) {
	section('12) profile 接线 —— 跳过（未传 --patch）');
} else {
	section('12) profile 接线 cordis.patch.yml');
	const patchPath = isAbsolute(patchArg) ? patchArg : resolve(process.cwd(), patchArg);
	check('patch 文件存在', existsSync(patchPath), patchPath);
	const text = readFileSync(patchPath, 'utf8');
	const expectedName = `file:///${resolve(PACKAGE_ROOT, manifest.exports['.']).replaceAll('\\', '/')}`;
	check('patch 内含本插件的路径行', text.includes(expectedName), expectedName);
	if (!args.includes('--yaml')) {
		console.log('  --   跳过 YAML 解析（未传 --yaml <yaml 包目录>）');
	} else {
		const yamlModule = await import(pathToFileURL(resolve(yamlArg, 'dist/index.js')).href);
		const parsed = yamlModule.parse(text);
		check('patch 顶层是数组', Array.isArray(parsed), typeof parsed);
		const rows = (Array.isArray(parsed) ? parsed : []).flatMap((entry) => entry.insert ?? []);
		const row = rows.find((candidate) => candidate.id === 'dsh-effort-picker');
		check('存在 id=dsh-effort-picker 的 insert 行', row !== undefined);
		check('该行 name 指向宿主半边', row?.name === expectedName, String(row?.name));
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
