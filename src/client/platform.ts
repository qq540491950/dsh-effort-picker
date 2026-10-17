/**
 * 平台种子模块的**唯一入口** —— 客户端半边所有对 `react` / `react-dom` /
 * `ui-primitives` 的取值都经过这里。
 *
 * 两个理由：
 *   1. **classic JSX runtime**：`h` 让 JSX 编译成 `h(...)`（= `react.createElement`），
 *      于是产物只需要 `require("react")`，不必赌 `react/jsx-runtime` 在平台种子表里。
 *   2. **单一 require**：打包器会为每个"值 import 了 react"的模块各发一次 `require("react")`；
 *      只在这里 import，产物里就一眼能看到"我们到底从平台拿了什么"。
 *
 * 纪律：这里只能出现平台种子表里的模块
 * （react / react-dom / cordis / dsh-client-store / ui-slots / ui-primitives / ui-dockkit）。
 * 其余依赖一律走 npm 并被打进产物——浏览器里没有 node_modules。
 */

import * as react from 'react';
import * as reactDom from 'react-dom';
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives';

export { react, reactDom, primitives };

/** JSX 工厂：`<div a="1" />` → `h('div', { a: '1' })`（见 tsconfig 的 `jsxFactory`）。 */
export const h = react.createElement;

/** `<>…</>` 的工厂（见 tsconfig 的 `jsxFragmentFactory`）。 */
export const Fragment = react.Fragment;
