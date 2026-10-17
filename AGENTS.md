# AGENTS.md

给**在这个仓库里动手的 AI 与人**看的约束清单。动手前先读完第 2 节——那里的每一条都对应一次真实故障，
相关代码看着"多余"但都不是。

## 1. 这是什么

DSH 桌面端（Web GUI）的**纯客户端**插件：把 composer 里官方的「模型名 · 思考模式 → 竖排列表」换成
Codex 风格的推理档位面板。

- **自用维护，不发布**。`package.json` 里 `"private": true`；不做 npm 发布、不写发布流程、
  不带版本发布脚本。接线有两种形态，二选一：**把本仓库当 bundle 安装**（`dsh.bundle.patch` 指向
  仓内 `cordis.patch.yml`，安装器去写 profile），或**在 profile 补丁层里手写一行 insert**。
- **运行时零依赖、源码是 TypeScript**。`src/**` 是唯一事实来源，`lib/*.js` 由 `tools/build.ts`
  （esbuild）生成——**改完必须 `npm run build`，永远不要手改 `lib/`**。第三方包只在构建期存在
  （会被打进产物），运行期仍然只向平台种子表要模块。
- 仓库里只有 Linux 风格 LF 换行（`.gitattributes` 强制），不要提交 CRLF。

### 文件职责

| 文件 | 职责 | 改它的风险 |
|---|---|---|
| `src/client/**` | 浏览器半边源码（TS/TSX）：`index` 插件体与出口、`platform` 平台种子入口、`picker`/`track`/`row`/`boundary` 组件、`styles`、`geometry`、`placement`、`dom`、`hooks` | **高**——第 2 节三条硬规则全在这里 |
| `src/host/index.ts` | 宿主半边：空的 `apply`，仅作为 Loader 的接线柱 | 低，但**不许删**：删了 `dsh-client-modules` 从该条目向上找不到 `package.json`，客户端 bundle 就不再投递 |
| `tools/build.ts` | 构建：esbuild 把 `src/` 打成 `lib/client.js`（外套 `__ModuleLoader__` 注册壳）与 `lib/index.js`，原子替换 + 写 `.build-manifest.json` | 高——外壳与 `id` 契约在这里，写错就整体不加载 |
| `tsconfig.json` / `tsconfig.tools.json` | `src/` 与 `tools/` 的类型检查（classic JSX：`jsxFactory = h`） | 中——配置漂了就查不出类型错 |
| `package.json` | 包清单契约（第 4 节）+ devDeps + 脚本 | 中——改错就整体不加载 |
| `cordis.patch.yml` | bundle 自带的补丁层：`insert` 一行把本插件接进 Loader（`dsh.bundle.patch` 指向它） | 中——写错等于"装了却没生效" |
| `lib/client.js` / `lib/index.js` | **产物**，不要手改 | 手改会被下次构建覆盖，且自检第 1 组会报"产物与源码不一致" |
| `tools/verify.ts` | 离线自检：纯 Node、无依赖，用 `node:vm` 跑**真实的** `lib/client.js` | 低；改它必须同步改断言，**不许为了让它变绿而放宽断言** |
| `README.md` | 面向使用者的介绍与使用说明 | 低 |
| `AGENTS.md` | 本文件（工程约束） | 低 |

## 2. 三条硬规则（各对应一次真实故障，别删相关代码）

### 2.1 遮蔽型座位：条目一抛错就被退役，控件彻底消失

`single` / `keyed` / `list` 这类遮蔽型座位在 DSH 里有一条硬规则：**条目抛出的错误被外层边界捕获后，
该条目被退役**（`SlotCore.reportEntryError(..., { abdicate: true })`）。退役是"每个注册条目一次性"的：
官方控件顶回来，且**要等页面刷新或 bundle 重新发布**才恢复。Slots 台账上的表现是
`priority -1 active: false` / `priority 0 active: true`。

因此本插件的纪律：

- **任何可能抛错的东西都不许放在 `inject` 工厂里**——那里抛错时座位组件连渲染机会都没有。
- 目录解析推迟到渲染期的 `resolve()`，并由座位内的 `SeatBoundary` 兜住：失败降级成一行"点击重试"，
  条目不会被退役。`SeatBoundary` **不是可选项**，它包住的是整个座位子树。
- 失败会写 `localStorage["dsh-effort-picker:last-failure"]`，控制台只打第一条
  （前缀 `[dsh-effort-picker]`），随后 150ms ×12 次自动重试——重试是给"服务刚上电"这类瞬时失败用的。

### 2.2 Cordis 的 Service 方法以**调用方上下文**求值

`modelDirectories` 是官方插件提供的服务，它的 `directoryFor()` 内部要用 `this.ctx.remote.session`。
我们从外部调用它时，`this.ctx` 重绑到**我们的**上下文，所以官方代码经 `this.ctx` 碰到的每一项服务
都必须出现在 `apply` 的 `ctx.inject([...])` 清单里，否则：

```
Error: cannot get property "remote.session" without inject
    at Proxy.directoryFor (官方 client.js)
    at resolve (lib/client.js)
```

**为什么偏偏"切换会话"才炸**：目录按会话缓存（官方 `live.directories` 以 binding 为键）。老会话的目录
是官方插件建的，缓存命中直接早退，轮不到我们碰 `this.ctx`；新会话的目录要**我们**去建，于是撞上注入缺失。
官方自己不会炸，因为它的静态 `inject` 清单里本来就有 `remote` / `remote.session`。

**当前清单必须保持这 5 项，一项都不能少**：

```js
ctx.inject(["slots", "modelDirectories", "sessions", "remote", "remote.session"], (scope) => { ... })
```

`tools/verify.ts` 第 4 节有专门针对它的回归护栏（逐项断言）。想删任何一项，先回答"官方那个方法会不会
经 `this.ctx` 用到它"。

### 2.3 HMR 可能读到半截文件

`dsh-client-hmr` 每 500ms 按 mtime/ctime/size 判版本。文件写到一半时被读到，按失败策略
「替换失败不回滚」，插件会彻底消失（界面里模型控件没了）。

**`tools/build.ts` 已经用「临时文件 + rename」原子替换**——这条纪律现在由构建脚本守着，
不要改成直接 `writeFile` 覆盖 `lib/client.js`，也不要手写 `lib/`。恢复办法见第 7 节。

## 3. 不能改的东西（不变量）

| 不变量 | 为什么 | 谁在守 |
|---|---|---|
| bundle `id` 必须等于 `package.json` 的 `name` | `dsh-client-modules` 用它做模块身份 | verify 第 3 节 |
| 座位注册必须留 `priority: -1` | 官方注册在 0，`single` 座位取"priority 最低者渲染"；改回 0 会与官方同 priority **直接报错**，改成 >0 则永远被官方盖住 | verify 第 4 节 |
| `inject` 工厂只交出 `resolve` 闭包，**不在里面解析** | 2.1 + 2.2 两条规则的交点 | verify 第 4 节 |
| `SeatBoundary` 必须包住座位子树 | 2.1 | verify 第 4b 节 |
| `require` 只能取平台种子模块：`react` / `react-dom` / `cordis` / `dsh-client-store` / `ui-slots` / `ui-primitives` / `ui-dockkit`（这是**允许集**；本插件实际只用了 `react` / `react-dom` / `ui-primitives`） | 种子表固化在 shell 里，取别的会 `require` 失败 | verify 第 3 节 |
| 新增第三方依赖只能是**构建期**的：必须被 esbuild 打进产物 | 浏览器里没有 `node_modules`；把依赖标成 external 等于运行时 `require` 失败 | verify 第 3 节（产物 require 面只允许种子） |
| `lib/*.js` 是**产物**，禁止手改 | 手改会被下一次构建覆盖；"只看 lib/ 不看 src/" 迟早把修复弄丢 | verify 第 1 组（`.build-manifest.json` 的 sha256 比对） |
| 宿主半边零 `import`、导出 `apply` | 它只当接线柱；多引入依赖就多一个失败面 | verify 第 2 节 |
| 文案硬编码中文、**不注册 locale 命名空间** | 有意少一个失败面 | 约定 |
| 数据面只走官方 `ctx.modelDirectories` 的 `directory.store` / `directory.select()`，写入只作用于**下一次请求** | 与 `/model` 命令看到的状态天然一致 | 约定 |
| 滑块 `THUMB_SIZE = 25`、`styles.thumb` 的 `25px` 与 `styles.track.height: "22px"` 三者同改 | 白圆钮刻意比轨道大一点（约 1.13:1，与参考图一致）；三者不一致就会看出偏移 | 人工 |
| 进度填充的 `width` 与滑块的 `left` 必须同用 `centerAt(ratio)` | 填充右端永远被滑块盖住，两者一旦不同源就会露出接缝 | verify 第 8b 组 |
| 轨道底色必须掺一档 `label-primary`（**不能**裸用 `bg-layer-2`），白点/白圆钮必须带描边 | 菜单面是半透明材质：裸 `bg-layer-2` 与面板同色（深色主题两者都≈`#2c2c2e`，浅色主题都≈白）→ 滑轨整条看不见、圆钮在浅色主题里也没有边界。实测踩过 | verify 第 7 节 |
| 触发器只显示**已提交**档位（`committedLabel`）；拖动预览（`effortLabel`）只允许出现在面板标题里 | 触发器在面板外面，跟着拖动预览变会让下方控件在 Low/Medium/High 之间跳、宽度跟着抖 | verify 第 8b 组 |
| 触发器**不放前导图标**（`IconDataOutlineRegular` 已去掉），且 `triggerEffort` 不跟 `--dsh-composer-model-text-display` 一起藏 | 位置和宽度仍与官方一致，但那枚"数据库"图标是多余的（反馈点掉）；紧凑模式官方会退化成"只剩一枚图标"，我们没图标了，档位必须留住，否则只剩一个 chevron 像坏了 | verify 第 6 节 |
| 触发器里模型名是 `label-secondary`、档位是 `label-caption`（比模型名浅一号，**不是** brand 色）；模型列表每个 provider 是一张圆角卡片（`border-l3` + `var(--dsw-radius-md)` + `color-mix(label-primary 5%, transparent)` 底），组名用 `label-tertiary`（比模型行的 `label-primary` 暗两档） | 文字层级要分得出主次：触发器里"模型名 · 档位"（反馈：档位的字浅一点），列表里"分组名 vs 模型名"（反馈两轮：只调字色"依然不明显"，所以整组框起来）。卡片不能用 `border-l1`（4%/6% 不透明度，框不出来），底色不能裸用 `bg-layer-2`（与半透明菜单面同色）；卡片形态下不做吸顶，否则组名会浮在边框外 | verify 第 6、10 节 |
| 面板 `width: "224px"` 与轨道 200px 同源 | 轨道不设自身宽度，撑满内容宽 = 面板宽 − 左右各 12px padding；改面板宽等于改轨道宽 | 人工 |
| `chooseModel` 必须带上新模型的**最高档**（`efforts.at(-1).id`），既不能省略 `reasoningEffort`、也不能用路由默认档 `defaultEffort` | 省略 = 会话档位被清空 → `activeIndex = -1` → 轨道不渲染滑块头，用户看到"滑块不行"；路由默认档是"一条路由一个值"，huawei 设成 high 后连支持 max 的模型也落在 high（两条都是实测反馈）。**只影响"刚切过去落在哪一格"，滑块照旧能拖到任意档** | verify 第 10 节（含"没有 defaultEffort 的模型也要带上最高档"） |
| 只要模型有档位，轨道上就必须画得出滑块头：`shownIndex = activeIndex >= 0 ? activeIndex : efforts.length - 1`；兜底时 `committedLabel` / `effortLabel` 补「（默认）」后缀 | 会话档位没显式设置时（官方 `/model` 切换）旧实现 `shownRatio = null` → thumb / fill 全不渲染，轨道看起来就是坏的；补后缀是为了不把兜底位置说成用户选过的档位 | verify 第 8c 组 |
| 模型列表里非当前模型显示的是**选中它会带上的档位**（= 该模型最高档），不是 `defaultEffort` | 显示路由默认档时同一条路由每个模型都是同一个值（huawei 全显示 High），看不出谁支持 max | verify 第 10 节 |

**不要顺手做的重构**：不把 `lib/` 当源码改；不给**运行期**加依赖（第三方包只能写进 `src/` 并被
打包进产物）；不改有意的硬编码；不"美化"间距到与现状不一致。`src/` 允许多文件、允许 JSX、允许
第三方包——但**产物必须是单文件 classic script**，不能是 ESM，`require` 面不能超出种子表。

## 4. 包清单契约

`dsh-client-modules` 的投递链路：扫「已启用的 Loader 条目」→ 从该条目的模块位置向上找最近的
`package.json` → 读 `dsh.client`（`platform` 必须为 `"web"`）→ 从 `exports["./client"]` 定位浏览器
bundle → Host 在 `/plugins` 下发布并写进浏览器 boot graph。

因此 `package.json` 里这几项是契约，不是风格：

- `name`：非作用域裸包名（`^[^/@:]+$`，verify 第 1 节断言）——带 `@scope/` 会导致投递失败。
- `exports["./client"]`：指向浏览器 bundle 的字符串。
- `exports["./package.json"]`：`"./package.json"`（投递链路要读清单本身）。
- `dsh.client.platform`：`"web"`。
- `dsh.bundle.patch`：`"./cordis.patch.yml"`——声明"本包是 bundle，接线在仓内这一层"。
  安装器据此把本包写进 profile 的 `dsh.profile.bundles`，profile 不再需要手写路径行。

## 5. 改动流程（做完算数才算完）

1. 改 `src/**`（TS/TSX 源码）。**不要**改 `lib/`。
2. **类型检查**：`npm run typecheck`（`src/` 与 `tools/` 两份 tsconfig 都要过）。
3. **构建**：`npm run build`（`src/` → `lib/client.js` + `lib/index.js`，原子替换 + 写清单）。
4. **跑自检**：

   ```powershell
   node tools/verify.ts
   ```

   可选参数：`--patch <profile 的 cordis.patch.yml 路径>` 校验"profile 接线了没有"——手写 insert 行
   或把本包列进 `dsh.profile.bundles`，两种形态都算通过；再带 `--yaml <yaml 包目录>` 用真实 YAML
   解析器校验（该目录需有 `dist/index.js`）。
5. **必须看到 `全部通过 ✓` 且退出码 0**。失败时会打印 `失败 N 项：` 并 `exit 1`。
6. 只有第 5 步过了才有资格说"改好了"。**禁止**在没跑自检、或自检失败的情况下汇报成功；也禁止用
   "看起来没问题"替代实际输出。
7. 提交（第 6 节）并推送。

自检覆盖 16 个分组（含 `4b` 降级、`8b` 连续跟手、`8c` 档位未设置时的滑块头、`11b` 面板落位）共 105 条
断言（带 `--patch` 时 107 条）：包清单契约与**构建新鲜度**（`src/` 改了没构建会直接失败，新增文件与
纯类型文件也算）、宿主 `apply`、
模块协议（含"产物只向平台要种子模块"）、`priority -1` 注册与注入清单回归护栏、`resolve()` 解析、解析失败
时座位内降级（不退役条目、上报控制台、排自动重试）、子代理会话短路、触发器文案（含"不放前导图标、
紧凑模式保留档位、档位比模型名浅"）、滑杆 ARIA、停靠点数量、进度填充与滑块同源、主题适配（轨道掺色 /
圆钮与停靠点带描边）、拖拽只提交一次且触发器不跟手跳、键盘调档、模型下钻（含"分组圆角卡片 + 组名暗两档
+ role=group"、"选模型带最高档 / 列表显示选中会带上的档位"）、档位未显式设置时滑块头仍在最高档且标
「默认」、失败提示保留面板、面板落位（上方优先 / 放不下翻转 / 左右不越界）、接线形态（bundle 补丁层；
带 `--patch` 时再查 profile 是手写行还是 bundle 安装）。第 12 组会把补丁里的 id / name 与**本机实际路径**
核对，所以**仓库搬家后要么重新安装 bundle，要么同步改 profile 里的路径行**（forward slash 形式）。

## 6. 提交与推送

- 提交信息用中文 Conventional Commits，与既有历史一致：`feat:` / `fix:` / `chore:` / `docs:`，一行说清改了什么。
- 推送目标固定：`origin` = `https://github.com/qq540491950/dsh-effort-picker.git`，分支 `main`。
- **不要提交敏感信息**：profile 的 `cordis.patch.yml` 里有 API key（MCP / 搜索 provider），它**不在本仓库内**，
  永远不要把它、或它的片段、或任何 token 复制进本仓库。仓库里没有 `.env`，也不需要。
- 提交前确认 `git status` 里没有意外文件；`.gitignore` 已覆盖 `node_modules/`、构建产物、`.env`、IDE/OS 垃圾。

## 7. 出问题时怎么恢复

| 症状 | 原因 | 恢复 |
|---|---|---|
| 界面里模型控件整个没了 | 条目被退役（2.1 / 2.3） | 重新 `npm run build`（内容不变也行，mtime/size 变了宿主就会发新 rev），或 `Ctrl+R` 刷新页面。不必重启 DSH |
| 想看到失败原因 | — | 读 `localStorage["dsh-effort-picker:last-failure"]`，或看控制台 `[dsh-effort-picker]` 前缀（只有第一条） |
| 想立刻回到官方控件 | — | bundle 形态用 `plugin_manager` 的 `set_bundle`（`enabled: false`）或 `remove_bundle`；手写形态删掉 `id: dsh-effort-picker` 那个 insert 行。官方选择器立刻回来 |

## 8. 安装形态：优先让安装器写 profile

profile 是**用户的环境**，不是本仓库的一部分：`C:\Users\admin\.dsh\profiles\desktop\cordis.patch.yml`。

**首选**：用 `plugin_manager` 的 `install_bundle`（GUI 里是「设置 → 插件 → 安装」，填同一串）。profile 的
`package.json` 依赖、`dsh.profile.bundles` 以及 Loader 行都由安装器写——本仓库只提供
`cordis.patch.yml` 那一层，不碰用户的其它配置。spec 有两种形态，装的是同一个包：

- `github:qq540491950/dsh-effort-picker#v0.0.2`：**成品形态**，钉 tag，profile 里是拷贝；
- `D:\project\dsh-plugins\dsh-effort-picker`：**开发形态**，profile 里是 junction，`npm run build` 即刻生效。

两条纪律：

- **改完要发布成新版本**：bump `package.json` 的 `version` → 提交 → `git tag -a vX.Y.Z` → 推 tag。
  同一 tag 的产物不会变（也不该变）；不 bump 版本就重打 tag 只会让人分不清装的是哪份。
- **`"files"` 不能删**：git / tarball 安装按它打包，`cordis.patch.yml` 不在里面会被判 `not-bundle`。
- **本地目录 ↔ URL 互换时先清 junction**：`remove_bundle` 可能留下
  `profile/node_modules/dsh-effort-picker` 这个指向仓库的 junction，再装 URL 版时 pnpm 会把整个开发目录
  （含 `node_modules` 的符号链接）往 store 里导入，报 `ERR_PNPM_EPERM ... symlink`。用
  `cmd /c rmdir "<profile>\node_modules\dsh-effort-picker"` 清掉（删的是 junction，不动仓库）。

**备选**（手写行）时：在 profile 补丁层里**只允许增删 `id: dsh-effort-picker` 这一个 insert 行**——
其它条目的配置（模型、推理强度、搜索 provider、MCP、密钥）都不属于本任务范围，不要"顺手"改。
补丁层里新增条目必须用 `insert:` 追加，裸写 `- id: ...` 会被当成覆盖目标，id 不存在时 Loader 报
`entry not found` 并丢弃该条。

卸载：bundle 形态用 `set_bundle` / `remove_bundle`；手写形态删掉那一行。

## 9. 本机事实（会漂移，别当契约）

- 仓库路径：`D:\project\dsh-plugins\dsh-effort-picker`（手写行形态下 profile 的路径行依赖它；
  bundle 形态下由安装器写下的 `file:` 依赖指向它，仓库搬家仍需重新安装）。
- profile 补丁：`C:\Users\admin\.dsh\profiles\desktop\cordis.patch.yml`。
- Node：v24.15.0（`tools/build.ts` 靠 Node 原生类型剥离直接跑 `.ts`，所以构建脚本只能写可擦除语法——
  `tsconfig.tools.json` 的 `erasableSyntaxOnly` 守着这条）；pnpm 12.14.0；TypeScript 5.9.3；esbuild 0.28.2。
- 目标座位：`conversation.input.model`；被遮蔽的官方插件：`@deepseek-ai/dsh-client-ui-model-selection`。
