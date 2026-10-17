/**
 * 宿主半边（Host half）。
 *
 * 这是纯客户端插件：宿主侧不需要任何行为。但 Loader 行仍然必须存在，因为
 * `@deepseek-ai/dsh-client-modules` 的投递链路是：
 *
 *   扫描「已启用的 Loader 条目」
 *     → 从该条目的模块位置向上找最近的 package.json
 *     → 读它的 `dsh.client` 声明（platform 必须为 "web"）
 *     → 从 `exports["./client"]` 定位浏览器 bundle
 *     → 由 Host 在 /plugins 下提供，并写进浏览器的 boot graph
 *
 * 所以这个空的 apply 就是"接线柱"本身。
 */

/** 宿主插件体——这个界面插件在宿主侧没有任何行为。 */
export function apply(): void {}
