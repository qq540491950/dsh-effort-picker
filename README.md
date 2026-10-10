# codex-effort-picker

把 DSH 桌面端（Web GUI）的**思考模式 / 推理档位**换成 Codex 风格面板的客户端插件。

## 它长什么样

点开 composer 里的模型控件：

```
┌───────────────────────────────┐
│ 推理等级              Medium  │   ← 当前档位（brand 色）
│ ╭───────────────────────────╮ │
│ │ ●━━━●━━━●━━━◉━━━●         │ │   ← 渐变轨道 + 离散停靠点 + 滑块
│ ╰───────────────────────────╯ │
│ ───────────────────────────── │
│ ◇ 模型   deepseek-v4.1-flash >│   ← 下钻到模型列表
└───────────────────────────────┘
```

折叠态就是一行 `模型名 + 档位（brand 色）+ chevron`，与官方选择器的位置、宽度、
紧凑模式（空间不够时折叠成图标）保持一致。

**交互**

| 操作 | 行为 |
|---|---|
| 点击轨道某处 | 立刻切到最近的档位 |
| 按住拖动 | 滑块**连续跟手**（onPointerMove 里直接写 DOM，不等 React 渲染），面板标题实时显示最近的档位；**松手才吸附并提交一次** |
| `←` / `→` | 降/升一档并提交（焦点在触发器上即可，不必先点面板） |
| `Home` / `End` | 跳到最低/最高档 |
| `Esc` | 退回上一层；已在根层则关闭面板 |
| 点击「模型」行 | 下钻到模型列表：按 provider 分组并显示分组标题，每行显示该模型的档位（当前模型显示**正在用的档位**，其它模型显示**选中后会生效的默认档位**），选中后带上该模型的默认档位 |
| 点击面板外 | 关闭 |

档位数是**自适应**的：直接取当前模型 `reasoning.efforts` 的长度。本机
`deepseek-v4.1-flash` / `space-bunny` 是 5 档（off/low/medium/high/max），
`glm-5.3*` 是 3 档（low/high/max）。模型没有推理元数据时，面板只显示模型行。

## 它怎么接管官方控件的

官方 `@deepseek-ai/dsh-client-ui-model-selection` 注册在 `conversation.input.model`
座位（`single` 类型）的 **priority 0**。DSH 的 `SlotCore` 规则是：`single` 座位允许
不同 priority 重复注册，**priority 最低者渲染**，同 priority 才报错。所以本插件注册在
**priority -1** 就接管了渲染，而官方插件仍然活着——`/model` 命令弹窗、共享的
`ModelDirectory` 全都不受影响，出问题时删掉接线即可退回。

数据面完全复用官方那个按会话共享的目录服务 `ctx.modelDirectories`：
`directory.store` 是 snapshot store（`useSyncExternalStore` 订阅），
写入走 `directory.select({provider, model, reasoningEffort})`，只作用于**下一次请求**。

## 目录结构

```
codex-effort-picker/
  package.json      包清单：exports{"./client"} + dsh.client{platform:"web"}
  lib/index.js      宿主半边：空的 apply，只作为 Loader 的接线柱
  lib/client.js     浏览器半边：window.__ModuleLoader__ 懒 CJS bundle（全部 UI）
  tools/verify.mjs  自检程序（纯 Node，零依赖）
```

运行时**零依赖**：宿主半边不 import 任何东西；浏览器半边只 `require` 平台种子表里的
`react` / `react-dom` / `@deepseek-ai/dsh-client-ui-primitives`（种子表固化在 shell 里，
不需要 `dsh.client.external` 声明）。

## 接线方式：路线 1「路径行」

不需要 pnpm、不需要 `node_modules`、不改 profile 的 `package.json`。只在
`C:\Users\admin\.dsh\profiles\desktop\cordis.patch.yml` 末尾加一个 insert 行：

```yaml
- insert:
    - id: codex-effort-picker
      name: 'file:///D:/project/dsh-plugins/codex-effort-picker/lib/index.js'
```

`dsh-client-modules` 的投递链路：扫描已启用的 Loader 条目 → 从该条目的模块位置向上找最近的
`package.json` → 读它的 `dsh.client` 声明 → 从 `exports["./client"]` 定位浏览器 bundle →
Host 在 `/plugins` 下发布并写进浏览器 boot graph。

**卸载 / 回滚**：删掉那个 insert 行即可，官方选择器立刻回来。

## 自检

```powershell
node D:\project\dsh-plugins\codex-effort-picker\tools\verify.mjs `
     --patch "C:\Users\admin\.dsh\profiles\desktop\cordis.patch.yml" `
     --yaml "C:\Users\admin\AppData\Local\Temp\dsh-asar-probe\out\dsh\node_modules\yaml"
```

（`--yaml` 可选，用真实 YAML 解析器校验 patch；不传就只做文本校验。）

自检程序用 `node:vm` 跑**真实的** `lib/client.js`，喂一个极简 React 替身（含 `Component`
与错误边界协议）与假 ctx，覆盖 13 组共 70+ 条断言：包清单契约、宿主 `apply`、模块协议、
`priority -1` 注册与**注入清单回归护栏**（必须含 `remote` / `remote.session`）、
`resolve()` 解析、解析失败时座位内降级（不退役条目、上报控制台、排自动重试）、
子代理会话短路、触发器文案、滑杆 ARIA、停靠点数量、拖拽只提交一次、键盘调档、
模型下钻、失败提示保留面板。

## 三条硬规则（都踩过）

### 1. 遮蔽型座位：条目抛错 = 被退役，控件消失

`single` / `keyed` / `list` 这类遮蔽型座位在 DSH 里有一条硬规则：**条目一旦抛错就被
退役**（渲染器外层边界 → `SlotCore.reportEntryError(..., { abdicate: true })`）。
退役是"每个注册条目一次性"的：官方控件顶回来，而且**要等页面刷新或 bundle 重新发布**
才会恢复。台账上的表现是 `priority -1 active: false` / `priority 0 active: true`。

恢复办法任选其一：

- 再保存一次 `lib/client.js`（内容不变也行，mtime/size 变了宿主就会发新的 rev）；
  用"写临时文件 + 原子替换"更稳，能避开下面第 3 条；
- 刷新页面（Ctrl+R）；
- 重启 DSH（没必要，最重）。

**纪律**：任何可能抛错的东西都不许放在 `inject` 工厂里——那里抛错时座位组件连渲染
机会都没有。本插件因此把目录解析推迟到渲染期的 `resolve()`，并由座位内的
`SeatBoundary` 兜住：条目再也不会被退役，失败降级成一行"点击重试"，并留一份
`localStorage["codex-effort-picker:last-failure"]`。

### 2. Cordis 的 Service 方法以**调用方上下文**求值

`modelDirectories` 是官方插件提供的服务，它的 `directoryFor()` 内部要用
`this.ctx.remote.session`。我们从外部调用它时，`this.ctx` 重绑到**我们的**上下文，
所以这些服务必须出现在 `apply` 的 `ctx.inject([...])` 清单里，否则：

```
Error: cannot get property "remote.session" without inject
    at Proxy.directoryFor (官方 client.js)
    at resolve (lib/client.js)
```

**为什么偏偏"切换会话"才炸**：目录按会话缓存（官方 `live.directories` 以 binding 为
键）。老会话的目录是官方插件建的，缓存命中直接早退，轮不到我们碰 `this.ctx`；
新会话的目录要**我们**去建，于是撞上注入缺失。官方自己不会炸，因为它的静态
`inject` 清单里本来就有 `remote` / `remote.session`。

当前清单：`["slots", "modelDirectories", "sessions", "remote", "remote.session"]`。
自检里有一条针对它的回归护栏（注入清单必须含这 5 项）。

### 3. HMR 可能读到半截文件

`dsh-client-hmr` 每 500ms 按 mtime/ctime/size 判版本。文件写到一半时被读到，按失败
策略「替换失败不回滚」，插件会彻底消失（界面里模型控件没了）。恢复办法见第 1 条。

## 已实测的事实

| 事项 | 证据 |
|---|---|
| 路径行被 Loader 加载 | `plugin_manager` 列出 `include:codex-effort-picker`，`fiberPhase: active` |
| `priority -1` 遮蔽成功 | Slots 台账：`priority: -1 active: true`（本插件）、`priority: 0 active: false`（官方） |
| 目标服务可解析 | 诊断探针确认 `slots` / `sessions` / `modelDirectories` / `remote` / `remote.session` 全部可达 |
| 官方功能未受影响 | `include:ui-model-selection` 仍 active；`/model` 命令注册未动 |
| 改动会热替换 | 改 `lib/client.js` 后无需刷新，Slots 台账随之变化 |
| 缺注入的崩法 | 切换会话时 `directoryFor()` 抛 `cannot get property "remote.session" without inject`，条目被退役（已修：清单补 `remote` / `remote.session`） |
| 条目抛错会被退役 | 同一实验里台账翻成 `-1 active: false` / `0 active: true`，且只有重新发布 bundle 才恢复 |
| 座位内边界能兜住 | `SeatBoundary` 捕获同一异常并渲染"点击重试"，条目留在台账上（自检 4b 覆盖） |

## 已知取舍

- **未做搜索与排序**：模型列表按 provider 分组平铺，但不做模糊搜索，也不做 provider 排序
  （官方把 DeepSeek Account 排在最前）。官方在 ≤4 个模型时也不显示搜索框；模型变多后需要补上
  （`/model` 命令弹窗仍是完整功能的那一个）。
- **文案硬编码中文**：没有注册 locale 命名空间（避免多一处失败面）。要跟随界面语言时补
  `ctx.locale.register(NS, {zh, en})` 并把 `locale: NS` 传给座位注册。
- **切模型会重置档位**：与官方一致，带上新模型的 `defaultEffort`。
- **滑块 16px / 轨道 26px**：滑块用 `transform: translate(-50%,-50%)` 精确居中（不用 margin
  半像素），并用面板底色的一圈"缺口"加投影把它从渐变轨道上切出来（不用 brand 色描边——同色系会
  糊在一起）；拖动中关掉 `transition`（否则动画会拖在手速后面），静止时才用 `left .12s` 平滑吸附。
  尺寸常量在 `lib/client.js` 顶部的 `THUMB_SIZE`，改它要同时改 `styles.track.height`。
- **停靠点与滑块按半个滑块内缩**：`left: calc(6px + (100% - 12px) × ratio)`，否则首尾档位的
  滑块会以轨道边缘为中心、戳出胶囊端头，端头圆角就看不出来了。
- **滑块底色是白色**：不跟随明暗主题（它压在饱和的 brand 渐变色上，两种主题下都成立）；
  轨道、刻度与文字全部用 `--dsw-alias-*` token。
