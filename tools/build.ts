/**
 * 构建脚本：TypeScript 源码 → 投递产物（`lib/client.js` / `lib/index.js`）。
 *
 * 为什么需要它：DSH 的投递链路只认 JS（`exports["./client"]` 指向的文件会被浏览器直接
 * 当 classic script 执行），所以源码语言和投递产物必须是两个东西。这里用 esbuild 把
 * `src/client/index.ts` 打成**一个** CJS bundle，再套上海报/页脚，让它成为
 * 「一个 classic script，执行时只向 `window.__ModuleLoader__.load` 注册一个 factory」。
 *
 * 三条纪律：
 *   1. `require` 只能留在平台种子模块上（见 {@link CLIENT_EXTERNALS}），其余依赖全部打进
 *      产物——浏览器里没有 node_modules 可查。
 *   2. 不压缩、不去掉可读性：产物要能被人直接读（出问题时 `lib/client.js` 就是现场）。
 *   3. 写文件走「临时文件 + rename」的原子替换：`dsh-client-hmr` 每 500ms 按 mtime/size
 *      判版本，就地截断写入有概率让它读到半截文件（插件会整块消失）。
 *
 * 产物清单落在 `lib/.build-manifest.json`，`tools/verify.mjs` 用它判断"源码改了但没重新
 * 构建"（否则线上跑的是旧产物，而一切看起来都通过了）。
 */

import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

/** 仓库根：本文件在 `<root>/tools/`。 */
const ROOT = resolve(import.meta.dirname, '..');
const LIB = join(ROOT, 'lib');

/** 客户端 bundle 允许在运行期向平台要的模块——其余一律打进产物。 */
const CLIENT_EXTERNALS = ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'];

interface Manifest {
	name: string;
	tool: string;
	/** 整个 `src/` 树的摘要：新增/删除文件、改类型声明也逃不掉。 */
	sourceTree: string;
	targets: Array<{ output: string; outputSha256: string; inputs: Record<string, string> }>;
}

const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as { name: string; version: string };

/** `window.__ModuleLoader__.load({...})` 的海报：打开 factory 作用域。 */
function clientBanner(): string {
	return `/**
 * 本文件由 \`tools/build.ts\` 从 \`src/client/index.ts\` 生成 —— **不要直接编辑**。
 *
 * 契约（见 @deepseek-ai/dsh-client-modules）：
 *   1. 这是一个普通 classic script，不是 ESM；执行时只做一件事：
 *      向 window.__ModuleLoader__ 注册一个 factory。
 *   2. factory 在首次被 materialize 时执行，返回的 exports 就是模块导出。
 *   3. id 必须等于本包 package.json 的 name（这里就是 ${JSON.stringify(pkg.name)}）。
 *   4. factory 里的 require 只能取平台种子模块：react / react-dom / cordis /
 *      dsh-client-store / ui-slots / ui-primitives / ui-dockkit。
 *
 * 设计说明、踩坑记录都在 src/client/ 与 AGENTS.md 里。
 */
window.__ModuleLoader__.load({
	id: ${JSON.stringify(pkg.name)},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
`;
}

/** 页脚：关掉 factory 作用域并交回 exports。 */
const CLIENT_FOOTER = `
		return module.exports;
	},
});
`;

const HOST_BANNER = `/**
 * 本文件由 \`tools/build.ts\` 从 \`src/host/index.ts\` 生成 —— **不要直接编辑**。
 */
`;

/** 原子替换写入；内容没变就跳过（不碰 mtime，HMR 不会多做一次无用发布）。 */
async function writeIfChanged(file: string, content: string): Promise<'written' | 'unchanged'> {
	const next = Buffer.from(content, 'utf8');
	try {
		const current = await readFile(file);
		if (current.equals(next)) return 'unchanged';
	} catch {
		/* 文件还不存在：照常写 */
	}
	const temp = `${file}.tmp-${String(process.pid)}`;
	await writeFile(temp, next);
	await rename(temp, file);
	return 'written';
}

function sha256(buffer: Buffer | string): string {
	return createHash('sha256').update(buffer).digest('hex');
}

async function hashFile(relativePath: string): Promise<string> {
	return sha256(await readFile(join(ROOT, relativePath)));
}

/** 整棵 `src/` 树的摘要（路径 + 内容，排序后取 sha256）——新增/删除文件也算改动。 */
async function sourceTreeDigest(): Promise<string> {
	const entries = await readdir(join(ROOT, 'src'), { recursive: true, withFileTypes: true });
	const files = entries
		.filter((entry) => entry.isFile())
		.map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
		.sort();
	const parts = await Promise.all(files.map(async (file) => `${file}\u0000${await hashFile(file)}`));
	return sha256(parts.join('\n'));
}

/**
 * 从 esbuild 的 metafile 里取出这次真正读过的**仓库源码**（相对仓库根、已排序）。
 *
 * 只留 `src/` 下的文件：`node_modules` 里的第三方包不进清单——清单的用途是判断
 * "源码改了有没有重新构建"，而依赖版本由 `pnpm-lock.yaml` 管；把依赖哈希写进来会让
 * 「删掉 node_modules 就跑不了自检」这种蠢事发生（verify 本来是纯 Node 的离线程序）。
 */
function inputsOf(outputFile: string, metafile: { outputs?: Record<string, { inputs?: Record<string, unknown> }> }): string[] {
	const inputs = metafile.outputs?.[outputFile]?.inputs ?? {};
	return Object.keys(inputs)
		.filter((input) => input.startsWith('src/'))
		.sort();
}

await mkdir(LIB, { recursive: true });

const manifest: Manifest = { name: pkg.name, tool: 'esbuild', sourceTree: await sourceTreeDigest(), targets: [] };
/** 构建摘要，最后一次性打印。 */
const report: string[] = [];

//#region 浏览器半边
const clientResult = await build({
	absWorkingDir: ROOT,
	entryPoints: ['src/client/index.ts'],
	outfile: 'lib/client.js',
	bundle: true,
	write: false,
	format: 'cjs',
	platform: 'browser',
	target: ['chrome120', 'safari17', 'firefox120'],
	// classic JSX runtime：`<div/>` → h("div")，产物只需要 require("react")，
	// 不必赌 `react/jsx-runtime` 在平台种子表里。
	jsx: 'transform',
	jsxFactory: 'h',
	jsxFragment: 'Fragment',
	external: CLIENT_EXTERNALS,
	banner: { js: clientBanner() },
	footer: { js: CLIENT_FOOTER },
	legalComments: 'none',
	charset: 'utf8',
	logLevel: 'warning',
	metafile: true,
});

const clientText = clientResult.outputFiles[0].text;
for (const required of [`id: ${JSON.stringify(pkg.name)}`, 'window.__ModuleLoader__.load({']) {
	if (!clientText.includes(required)) throw new Error(`产物缺少接线契约：${required}`);
}
const clientInputs = inputsOf('lib/client.js', clientResult.metafile);
report.push(`lib/client.js  ${(await writeIfChanged(join(LIB, 'client.js'), clientText))}  ${String(clientText.length)} B  ← ${String(clientInputs.length)} 个源文件`);
manifest.targets.push({
	output: 'lib/client.js',
	outputSha256: sha256(clientText),
	inputs: Object.fromEntries(await Promise.all(clientInputs.map(async (input) => [input, await hashFile(input)] as const))),
});
//#endregion

//#region 宿主半边
const hostResult = await build({
	absWorkingDir: ROOT,
	entryPoints: ['src/host/index.ts'],
	outfile: 'lib/index.js',
	bundle: true,
	write: false,
	format: 'esm',
	platform: 'neutral',
	target: 'node22',
	banner: { js: HOST_BANNER },
	legalComments: 'none',
	charset: 'utf8',
	logLevel: 'warning',
	metafile: true,
});
const hostText = hostResult.outputFiles[0].text;
if (!hostText.includes('export {')) throw new Error('宿主产物没有导出任何东西（apply 丢了？）');
const hostInputs = inputsOf('lib/index.js', hostResult.metafile);
report.push(`lib/index.js   ${(await writeIfChanged(join(LIB, 'index.js'), hostText))}  ${String(hostText.length)} B  ← ${String(hostInputs.length)} 个源文件`);
manifest.targets.push({
	output: 'lib/index.js',
	outputSha256: sha256(hostText),
	inputs: Object.fromEntries(await Promise.all(hostInputs.map(async (input) => [input, await hashFile(input)] as const))),
});
//#endregion

// esbuild 的版本号从它自己的 package.json 读，避免写死一个会漂的字符串。
const esbuildPkg = JSON.parse(await readFile(join(ROOT, 'node_modules/esbuild/package.json'), 'utf8')) as { version: string };
manifest.tool = `esbuild@${esbuildPkg.version}`;

await writeIfChanged(join(LIB, '.build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

for (const line of report) console.log(line);
console.log(`构建完成（${String(manifest.targets.length)} 个产物）`);
