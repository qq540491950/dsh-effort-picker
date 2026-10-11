# dsh-effort-picker

把 DSH 桌面端（Web GUI）composer 里的**思考模式 / 推理档位**换成 Codex 风格面板的客户端插件。

> 自用维护的小插件，不发布（`package.json` 里 `"private": true`）。全部行为只在浏览器侧，
> 宿主侧是空的接线柱；删掉接线就立刻回到官方界面。工程约束与硬规则见 [AGENTS.md](AGENTS.md)。

## 它长什么样

点开 composer 里的模型控件：

```
┌───────────────────────────────┐
│            Medium             │   ← 当前档位（brand 色，居中）
│     deepseek-v4.1-flash ›     │   ← 模型名，点击下钻模型列表
│ ●━━━━━●━━━━━◉──────────────── │   ← 品牌色进度填充 + 停靠点 + 白色圆钮
└───────────────────────────────┘
```

折叠态就是一行 `模型名（secondary）+ 档位（caption，更浅）+ chevron`，位置、宽度与官方选择器一致：
档位比模型名浅一号，主次一眼分得出来（面板标题里的档位仍然是 brand 色，那是面板的主角）。
**没有前导图标**（官方那枚"数据库"图标按反馈去掉了）：空间不够时 composer 会给座位设
`--dsh-composer-model-text-display: none`，官方选择器那时只剩一枚图标，我们则**保留档位**——
`Max ⌄` 这样一格，总比只剩一个 chevron 好认。

## 交互

| 操作 | 行为 |
|---|---|
| 点击轨道某处 | 立刻切到最近的档位 |
| 按住拖动 | 滑块与品牌色进度填充**连续跟手**（onPointerMove 里直接写 DOM，不等 React 渲染），**只有面板标题**实时显示最近的档位；**松手才吸附并提交一次**。面板外面那个触发器只显示**已提交**档位，拖档时它不会跟着跳（宽度也不会抖） |
| `←` / `→` | 降/升一档并提交（焦点在触发器上即可，不必先点面板） |
| `Home` / `End` | 跳到最低/最高档 |
| `Esc` | 退回上一层；已在根层则关闭面板 |
| 点击标题下方的模型名（带 ›） | 下钻到模型列表：按 provider 分成一张张圆角卡片（卡片头是组名，比模型名**暗两档**，见下），每行显示该模型的档位（当前模型显示**正在用的档位**，其它模型显示**选中后会生效的默认档位**），选中后带上该模型的默认档位 |
| 点击面板外 | 关闭 |

档位数是**自适应**的：直接取当前模型 `reasoning.efforts` 的长度。本机
`deepseek-v4.1-flash` / `space-bunny` 是 5 档（off/low/medium/high/max），
`glm-5.3*` 是 3 档（low/high/max）。模型没有推理元数据时，面板只显示标题区与一行说明（没有滑轨）。

## 它是怎么工作的

它是**叠**在官方控件上，不是替换。官方 `@deepseek-ai/dsh-client-ui-model-selection` 注册在
`conversation.input.model` 座位（`single` 类型）的 priority 0；DSH 的 `SlotCore` 规则是
`single` 座位允许不同 priority 重复注册、**priority 最低者渲染**，所以本插件注册在
**priority -1** 就接管了渲染，而官方插件仍然活着——`/model` 命令弹窗、共享的
`ModelDirectory` 全都不受影响。

数据面完全复用官方那个按会话共享的目录服务 `ctx.modelDirectories`：订阅
`directory.store`，写入走 `directory.select({provider, model, reasoningEffort})`，
只作用于**下一次请求**。

## 安装（接线）

不需要 pnpm、不需要 `node_modules`、不改 profile 的 `package.json`。只在
`C:\Users\admin\.dsh\profiles\desktop\cordis.patch.yml` 末尾加一个 insert 行：

```yaml
- insert:
    - id: dsh-effort-picker
      name: 'file:///D:/project/dsh-plugins/dsh-effort-picker/lib/index.js'
```

`name` 必须指向本仓库的 `lib/index.js`（正斜杠形式）。**仓库一搬家就要同步改这一行。**
之后 `dsh-client-modules` 的投递链路会接手：从该条目的模块位置向上找最近的
`package.json` → 读 `dsh.client` 声明 → 从 `exports["./client"]` 定位浏览器 bundle →
Host 在 `/plugins` 下发布并写进浏览器 boot graph。

保存后由 Loader 加载；界面若没变化，按 `Ctrl+R` 刷新一次。

## 卸载 / 回滚

删掉那个 insert 行即可，官方选择器立刻回来（客户端插件随 Loader 条目一起卸载）。

## 自检

```powershell
node D:\project\dsh-plugins\dsh-effort-picker\tools\verify.mjs `
     --patch "C:\Users\admin\.dsh\profiles\desktop\cordis.patch.yml" `
     --yaml "C:\Users\admin\AppData\Local\Temp\dsh-asar-probe\out\dsh\node_modules\yaml"
```

（`--patch` 校验接线行还在不在、路径对不对；`--yaml` 可选，用真实 YAML 解析器校验 patch，
不传就只做文本校验。不带 `--patch` 时只有第 12 组跳过，其余 13 组照样跑。）

自检是纯 Node、零依赖的离线程序：用 `node:vm` 跑**真实的** `lib/client.js`，喂一个极简 React
替身与假 ctx，覆盖 14 组共 87 条断言。全部通过时打印 `全部通过 ✓` 并以 0 退出。

## 出问题时

| 症状 | 怎么办 |
|---|---|
| 界面里模型控件整个没了 | 重新保存一次 `lib/client.js`（内容不变也行），或按 `Ctrl+R`。不必重启 DSH |
| 想知道为什么失败 | 读 `localStorage["dsh-effort-picker:last-failure"]`，或看控制台 `[dsh-effort-picker]` 前缀的记录 |
| 想立刻回到官方控件 | 删掉 profile 里的 insert 行 |

前两种都是"条目被退役"的表现，成因与恢复细节见 [AGENTS.md](AGENTS.md) 第 2、7 节。

## 已知取舍

- **未做搜索与排序**：模型列表按 provider 分组平铺，但不做模糊搜索，也不做 provider 排序
  （官方把 DeepSeek Account 排在最前）。官方在 ≤4 个模型时也不显示搜索框；模型变多后需要补上
  （`/model` 命令弹窗仍是完整功能的那一个）。
- **文案硬编码中文**：没有注册 locale 命名空间（避免多一处失败面）。
- **每个 provider 是一张圆角卡片**：只靠字色/字号分层被反馈"依然不明显"，所以整组用
  `1px solid var(--dsw-alias-border-l3)`（12%/16% 不透明度；`border-l1` 只有 4%/6%，框不出来）
  + `var(--dsw-radius-md)` 圆角 + `color-mix(label-primary 5%, transparent)` 掺色底框起来。
  组名另外用 `--dsw-alias-label-tertiary`（比模型行的 `label-primary` 暗两档，与官方 `MenuGroup`
  取值一致）+ 11px/500/字距，读起来是"标签"而不是模型名。
  分组容器是 `role="group"` 并由组名命名、可见组名 `aria-hidden`，读屏不会把组名跟模型名连读。
  没有直接用官方 `MenuGroup` 组件，是为了不引入 `observeStickyMenuGroups` 那套观察器
  （多一个失败面）；卡片形态下也刻意不做吸顶——组名会浮在卡片边框外面，反而更乱。
- **切模型会重置档位**：与官方一致，带上新模型的 `defaultEffort`。
- **面板 224px / 滑轨 200px**：轨道不设自身宽度，直接撑满面板内容宽——尺寸就是
  `styles.menu.width` 减去左右各 12px padding（224 − 24 = 200）。想再收窄滑轨只改这一个常量即可；
  代价是面板里的模型名可显示的字符数变少。
- **滑块 25px / 轨道 22px**：白色圆钮按参考图刻意比轨道大一点（约 1.13:1，会从轨道上下各探出
  约 1.5px）；滑块用 `transform: translate(-50%,-50%)` 精确居中（不用 margin 半像素）；拖动中同时
  关掉滑块 `left` 与填充 `width` 的 `transition`（否则动画会拖在手速后面），静止时才用 `.12s`
  平滑吸附。
- **轨道底色必须掺一档 `label-primary`**（`color-mix` 10% + `bg-layer-2`）：菜单面是**半透明**材质
  （深色主题 `#43454a73`、浅色主题 `#f8f9fa94`），直接拿 `bg-layer-2` 当轨道底色时它与面板几乎同色
  （深色主题两者都≈`#2c2c2e`，浅色主题都≈白）——滑轨会整条"糊"进面板，看不出轨道有多长。掺一档
  label-primary（深色主题近白、浅色主题近黑）就永远比面板差一档。
- **白点与白圆钮都带一圈极淡的黑描边**：浅色主题里轨道浅灰、面板近白，纯白圆钮的边界会消失；
  停靠点同理（半透明白点 + 1px `rgba(0,0,0,.18)`）。参考图上没有这两样，但那是在深色主题下截的。
- **进度填充与滑块同源**：填充的 `width` 与滑块的 `left` 都用 `centerAt(ratio)`，填充右端永远被
  滑块盖住；最低档时它整段藏在圆钮下面，轨道看上去是空的（与参考图的"轻度"状态一致）。
- **停靠点与滑块按半个滑块内缩**：`left: calc(12.5px + (100% - 25px) × ratio)`，否则首尾档位的
  滑块会以轨道边缘为中心、戳出胶囊端头，端头圆角就看不出来了。
- **滑块底色是白色**：不跟随明暗主题（它压在饱和的 brand 填充与深色轨道上，两种主题下都成立）；
  轨道、刻度与文字全部用 `--dsw-alias-*` token。
- **拖动预览只出现在面板里**：面板标题用 `effortLabel`（跟手），面板**外面**的触发器用
  `committedLabel`（已提交档位）。触发器跟着拖动变的话，下方那行会在 Low/Medium/High 之间跳、
  文字宽度也会抖。

## 目录结构

```
dsh-effort-picker/
  package.json      包清单：exports{"./client"} + dsh.client{platform:"web"}
  lib/index.js      宿主半边：空的 apply，只作为 Loader 的接线柱
  lib/client.js     浏览器半边：window.__ModuleLoader__ 懒 CJS bundle（全部 UI）
  tools/verify.mjs  自检程序（纯 Node，零依赖）
  AGENTS.md         工程约束：硬规则、不变量、改动流程
```

运行时**零依赖**：宿主半边不 import 任何东西；浏览器半边只 `require` 平台种子表里的
`react` / `react-dom` / `@deepseek-ai/dsh-client-ui-primitives`（种子表固化在 shell 里，
不需要 `dsh.client.external` 声明）。

## 改代码前

必须先读 [AGENTS.md](AGENTS.md)：那里写了三条各对应一次真实故障的硬规则（条目抛错即被退役、
Cordis 注入清单、HMR 读到半截文件）、不能改的不变量，以及"改完必须跑自检并看到 `全部通过 ✓`"
的流程。
