# dsh-effort-picker

把 DSH 桌面端（Web GUI）composer 里的**思考模式 / 推理档位**换成 Codex 风格面板的客户端插件。

> 自用维护的小插件，不发布（`package.json` 里 `"private": true`）。全部行为只在浏览器侧，
> 宿主侧是空的接线柱；删掉接线就立刻回到官方界面。工程约束与硬规则见 [AGENTS.md](AGENTS.md)。
>
> 源码是 TypeScript（`src/`），投递产物是 esbuild 打出来的 `lib/client.js` / `lib/index.js`。
> 装插件**不需要** pnpm（`file://` 直接指向 `lib/index.js`）；**改代码需要**——见「开发」。

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
| 点击标题下方的模型名（带 ›） | 下钻到模型列表：**按 provider 分框**，每个 provider 一个框（带组内模型数），框内是单行模型（模型名 + 档位 + 勾，档位紧跟在模型名后边）；当前模型显示**正在用的档位**，其它模型显示**选中它会带上的档位**（= 该模型的最高档），选中后带上该模型的最高档。不提供搜索框，列表滚动条隐藏 |
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

## 安装

### 推荐：当成 bundle 安装（不手改 profile）

仓库自身就是一个 bundle：`package.json` 的 `dsh.bundle.patch` 指向 [cordis.patch.yml](cordis.patch.yml)，
那一层里的 `insert` 行就是接线本身。安装时由 DSH 写 profile 的 `package.json` 依赖与
`dsh.profile.bundles`，卸载时随依赖一起消失——**不再有"仓库搬家要手改路径行"**这个坑。

两种入口，装的是同一个东西：

| 场景 | 填什么 | 装完是什么 |
|---|---|---|
| 当成品用 | `github:qq540491950/dsh-effort-picker#v0.0.8`（完整写法 `git+https://github.com/qq540491950/dsh-effort-picker.git#v0.0.8` 也行） | profile 里的**拷贝**；钉住 tag，改代码要 bump 版本 + 打新 tag 再装。tag 必须与 `package.json` 的 `version` 一致（当前 `0.0.8`） |
| 开发迭代 | `D:\project\dsh-plugins\dsh-effort-picker`（绝对路径） | profile 里的 **junction**；`npm run build` 之后 HMR 立刻看到新产物 |

在 GUI 里是**侧栏「插件」→「添加插件」**（主按钮直接打开安装对话框；箭头里的「安装第三方插件」打开同一个框），
把上面那串粘进包名输入框、点「安装」；安装完成的画面再点**立即启用**（直接关掉对话框等于"装好但停用"）。
同样的事也可以由 `plugin_manager` 的 `install_bundle`（`target` 传这一串）完成。安装器先 `inspect` 再装，
**识别出的 spec 形态**只有四类：registry 名、绝对路径、git 地址、tarball。

装完界面若没变化，按 `Ctrl+R` 刷新一次。想确认台账里有没有生效，用 `cordis_inspect_query`
（Client · `Slots.listSubTree`，root = `conversation.input.model`）看是否多了一条 `priority -1` 的 occupant。

> 只有发布到 npm 之后才能直接填包名（`dsh-effort-picker` / `dsh-effort-picker@0.0.8`）；
> 现在 `"private": true` 且未发布，所以要用 git 地址、绝对路径或 tarball。

#### 两个必须知道的坑

1. **`file` 字段别删**。git / tarball 安装会打包整个仓库，`"files": ["lib", "cordis.patch.yml", "README.md"]`
   把它收成"产物 + 补丁层 + 说明"；少了 `cordis.patch.yml` 会被判 `not-bundle` 而回滚。
2. **从本地目录切到 URL 安装时，先清掉 junction**：`install_bundle` 装目录会把
   `profile/node_modules/dsh-effort-picker` 做成指向仓库的 junction，`remove_bundle` 之后它**可能还留着**；
   接着装 URL 版时 pnpm 会试着把整个开发目录（含 `node_modules` 里的符号链接）导入 store，报
   `ERR_PNPM_EPERM ... symlink`。删掉残留即可（`rmdir` 删的是 junction，不会动仓库）：

   ```powershell
   cmd /c rmdir "C:\Users\admin\.dsh\profiles\desktop\node_modules\dsh-effort-picker"
   ```

（安装失败时安装器会把 profile 的 `package.json` / `pnpm-lock.yaml` 回滚到安装前——实测过，不会留半成品。）

### 备选：profile 里手写一行（老办法）

不想让 profile 依赖本仓库时，只在 `C:\Users\admin\.dsh\profiles\desktop\cordis.patch.yml`
末尾加一个 insert 行：

```yaml
- insert:
    - id: dsh-effort-picker
      name: 'file:///D:/project/dsh-plugins/dsh-effort-picker/lib/index.js'
```

`name` 必须指向本仓库的 `lib/index.js`（正斜杠形式）——**仓库一搬家就要同步改这一行**。

包清单另有 `engines.dsh`（当前 `>=0.2.0-rc.2 <0.3.0`）：DSH 版本不匹配时安装器会直接拒绝，
而不是装上一个客户端契约已经变了的包。

两种形态只差"这一行谁写"，之后 `dsh-client-modules` 的投递链路完全一样：从该条目的模块位置
向上找最近的 `package.json` → 读 `dsh.client` 声明 → 从 `exports["./client"]` 定位浏览器 bundle
→ Host 在 `/plugins` 下发布并写进浏览器 boot graph。

## 卸载 / 回滚

- bundle 安装的：插件页里把该组合包**关掉**（卸载按钮则先确认再移除）；同一件事也可以由
  `plugin_manager` 的 `set_bundle` / `remove_bundle` 完成；
- 手写行的：删掉那一行。

官方选择器立刻回来（客户端插件随 Loader 条目一起卸载）。

## 开发（改代码）

```powershell
pnpm install            # 一次即可：构建链 + Vitest/jsdom/Testing Library
pnpm typecheck          # src/、tools/、tests/ 三份 tsconfig 都过一遍
pnpm build              # src/ → lib/client.js + lib/index.js（并写 .build-manifest.json）
pnpm test               # 真实 React + jsdom：焦点/Tab/Esc/pending/拖拽/失败态
node tools/verify.ts   # 拿真实产物跑投递契约自检
# 或者一条命令：pnpm check（typecheck + build + verify + test）
```

`lib/` 是**产物**：手改它，下一次构建就没了；只改 `src/` 不构建，自检会直接报
「产物与源码一致」失败——它按 `lib/.build-manifest.json` 里的 sha256 比对，不看你跑过什么命令。
构建用「临时文件 + rename」原子替换，所以 HMR 不会读到半截文件（见 AGENTS.md 第 2.3 节）。

## 自检

```powershell
node D:\project\dsh-plugins\dsh-effort-picker\tools\verify.ts `
     --patch "C:\Users\admin\.dsh\profiles\desktop\cordis.patch.yml" `
     --yaml "C:\Users\admin\AppData\Local\Temp\dsh-asar-probe\out\dsh\node_modules\yaml"
```

（`--patch` 校验"profile 到底接线了没有"：手写 insert 行，**或**把本包列进 `dsh.profile.bundles`
都算通过；`--yaml` 可选，用真实 YAML 解析器校验该 patch 能解析。不带 `--patch` 时只有第 12b 组跳过。）

自检是纯 Node、零依赖的离线程序（本身也是 TS，靠 Node 原生类型剥离直接跑）：用 `node:vm` 跑
**真实的** `lib/client.js`，喂一个极简 React 替身与假 ctx，覆盖 16 组共 128 条断言（带 `--patch` 时
130 条）。它守的是投递契约、注入清单、数据换算和视觉不变量；交互行为另由
`tests/picker.client.spec.tsx` 的 10 条 Vitest + jsdom 用例覆盖（焦点、Tab/Shift+Tab、Esc、pending、
拖拽取消、键盘导航、空态/失败态）。全部通过时打印 `全部通过 ✓` 并以 0 退出。

## 出问题时

| 症状 | 怎么办 |
|---|---|
| 界面里模型控件整个没了 | `pnpm build:force`（内容不变也重写产物，mtime 变了宿主才会发新 rev），或按 `Ctrl+R`。不必重启 DSH |
| 想知道为什么失败 | 读 `localStorage["dsh-effort-picker:last-failure"]`，或看控制台 `[dsh-effort-picker]` 前缀的记录 |
| 想立刻回到官方控件 | bundle 安装的用 `set_bundle` 关掉 / `remove_bundle`；手写行的删掉那一行 |

前两种都是"条目被退役"的表现，成因与恢复细节见 [AGENTS.md](AGENTS.md) 第 2、7 节。

## 已知取舍

- **未做 provider 排序**：模型列表按 provider 分框，不做 provider 排序（官方把 DeepSeek Account 排在最前）。
  不提供搜索框（用户要求），模型多时用上下键 / Home / End 导航；`/model` 命令弹窗仍是完整功能的那一个。
- **文案硬编码中文**：没有注册 locale 命名空间（避免多一处失败面）。
- **模型列表按 provider 分框、框内平铺**：每个 provider 一个框（1px 边框 + 8px 圆角 + 3% 底色），
  框头是 `group.name ?? group.id`（11px / 600 `label-secondary`，右侧组内模型数，带底部分隔线），
  框内每行是「模型名 + 档位 + 勾」，档位紧跟在模型名后边（当前模型显示正在用的档位，其它模型显示
  选中后会带上的最高档）；当前行用 `color-mix(label-primary 11%, transparent)` 底色 + 行尾勾标出来。
  分框是为了回答"这个模型是谁家的"——用户配置的第三方路由（cpa / huawei / tengxun…）和官方
  provider 的模型混在同一个列表里，只有 `aria-label` 的时候肉眼分不出。**没有模型的 provider 不渲染空框**；
  `aria-label` 照旧带 provider（"模型名，provider，当前/选中后 档位"），读屏不依赖"组标题被念过"。
  **搜索框已移除，列表滚动条隐藏**（用户 2026-10-24 要求）；模型多时用上下键 / Home / End 导航。
  早先撤掉的是「每行一张 provider 圆角卡片」，别把行做成卡片（AGENTS.md 第 3 节也钉了这条）。
- **切模型带上该模型的最高档**（不是路由默认档，也不是"不带档位"）：
  - 不带档位会把会话档位**清空**，选择器随即没有滑块头（`activeIndex = -1` → 轨道不渲染
    thumb / fill），看起来就是"滑块不行"；
  - 路由默认档（`providers.<route>.reasoning`）是**一条路由一个值**：huawei 设成 `high` 之后，
    连声明了 `max` 的 `global:deepseek-v4.1-flash` 也默认落在 `high`。
  - 只决定"刚切过去落在哪一格"，切过去之后滑块照旧能拖到该模型声明过的任意一档。
- **档位没显式设置时滑块头也在**：会话档位被清空（比如官方 `/model` 切过）而模型又没有路由
  默认档时，轨道会兜底画在该模型的最高档，并在触发器与面板标题上标「（默认）」——不把兜底
  位置说成用户选过的档位。
- **面板 224px / 滑轨 200px**：轨道不设自身宽度，直接撑满面板内容宽——尺寸就是
  `styles.menu.width` 减去左右各 12px padding（224 − 24 = 200）。想再收窄滑轨只改这一个常量即可；
  代价是面板里的模型名可显示的字符数变少。
- **滑块 25px / 轨道 22px**：参考图（Codex 档位面板，面板 310px 宽）里轨道 30px、圆钮 34.5px，
  占面板宽的 9.7% / 11.1%；本面板 224px 等比换算就是 22px / 25px，比值 1.14:1，圆钮上下各探出
  1.5px。滑块用 `transform: translate(-50%,-50%)` 精确居中，拖动中轻放大到 `1.04` 并关掉 `left`
  的过渡（否则动画会拖在手速后面），静止时才用 `.12s` 平滑吸附。
- **填充是一块纯色浅蓝 `#88c0d0`**（无渐变、无高光、无描边）：这是从参考图实测取的颜色
  （136/192/208），图上横向纵向都是同一个值。想让它跟随主题品牌色，把 `styles.fill.background`
  换成 `color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, #fff)` 即可（代价是色相随主题漂）。
- **停靠点是"淡淡的小白点"**：4px 直径、把「白 62% + label-primary 38%」再降到 34% 透明叠上去
  （实测参考图为白 28.6% 叠在填充上）。用 label-primary 掺色是为了浅色主题——裸半透明白点落在浅灰
  轨道上会彻底消失（实测踩过）；深色主题下 label-primary 近白，看起来就是参考图那种"只亮一点点"。
- **圆钮是干净的白球**：没有品牌色光晕、没有大投影；边界用 `inset 0 0 0 1px rgba(0,0,0,.10)`
  （画在球**内侧**——外侧投影会被 `clip-path` 裁掉）。按下时只把内侧描边加深一点。
- **形状三层保险**（轨道与填充必须是胶囊、圆钮与停靠点必须是正圆）：
  1. 内联 `borderRadius: 999px / 50%`；
  2. `clipPath: 'inset(0 round 999px)'` / `'circle(50%)'`——填充、停靠点、滑块各带一份，
     这是独立于圆角的裁剪几何，宿主改圆角也压不扁；
  3. `src/client/index.ts` 的 `SHAPE_CSS` 用 `ctx.effect` 注入
     `[data-dsh-effort-picker-*]{border-radius:…!important}`——**轨道只能靠这一层**：
     `clip-path` 会连子树一起裁，那样会把探出轨道 1.5px 的滑块切平。

  为什么要这么麻烦：实测在 DSH 的 popover 里，内联的 `999px / 50%` 会被渲染成**约 8px 圆角**
  （轨道两端变成圆角矩形、圆钮变成圆角方块）；`!important` 是唯一能赢过它的声明，`clip-path`
  是不受它影响的几何。verify 第 7 组把这三层都钉成了断言。
- **轨道底色必须掺一档 `label-primary`**（`color-mix` 10% + `bg-layer-2`）：菜单面是**半透明**材质
  （深色主题 `#43454a73`、浅色主题 `#f8f9fa94`），直接拿 `bg-layer-2` 当轨道底色时它与面板几乎同色
  （深色主题两者都≈`#2c2c2e`，浅色主题都≈白）——滑轨会整条"糊"进面板，看不出轨道有多长。掺一档
  label-primary（深色主题近白、浅色主题近黑）就永远比面板差一档。
- **进度填充与滑块同源**：填充的 `width` 与滑块的 `left` 都用 `centerAt(ratio)`，填充右端永远被
  滑块盖住；最低档时它整段藏在圆钮下面，轨道看上去是空的（与参考图的"轻度"状态一致）。
- **停靠点与滑块按半个滑块内缩**：`left: calc(12.5px + (100% - 25px) × ratio)`，否则首尾档位的
  滑块会以轨道边缘为中心、戳出胶囊端头，端头圆角就看不出来了。
- **滑块底色是白色**：不跟随明暗主题（它压在饱和的 brand 填充与深色轨道上，两种主题下都成立）；
  轨道、刻度与文字全部用 `--dsw-alias-*` token。
- **拖动预览只出现在面板里**：面板标题用 `effortLabel`（跟手），面板**外面**的触发器用
  `committedLabel`（已提交档位）。触发器跟着拖动变的话，下方那行会在 Low/Medium/High 之间跳、
  文字宽度也会抖。
- **源码是 TS、产物是 JS**：投递链路只认 `.js`（浏览器直接当 classic script 执行），所以中间
  必须有 `pnpm build` 这一步。产物不压缩、带一段说明外壳，出问题时它就是现场；但**事实来源是
  `src/`**，别去改 `lib/`。
- **面板定位用 `@floating-ui/dom`**：打开瞬间的位置由纯函数 `estimatePanelPosition()` 同步给出
  （贴触发器上方、放不下翻到下方、左右不越界——三条都有离线断言），随后由 `autoUpdate` 跟随
  composer 撑高、窗口缩放、外层滚动容器移动。手写这套监听会漏掉 `ResizeObserver` 那类变化。
- **打开态的触发器也上底色**：只靠 hover 的话，看不出这个按钮正被按住（面板已经开了）。

## 目录结构

```
dsh-effort-picker/
  src/client/        浏览器半边源码（TS/TSX）：platform 平台入口、styles、geometry、
                     placement、dom、hooks、boundary、row、track、picker、index
  src/host/index.ts  宿主半边：空的 apply，只作为 Loader 的接线柱
  tools/build.ts     esbuild 构建：src/ → lib/*.js（产物自带 __ModuleLoader__ 外壳）
  tools/verify.ts   自检程序（纯 Node，零依赖）
  lib/client.js      产物：window.__ModuleLoader__ 懒 CJS bundle（**不要手改**）
  lib/index.js       产物：宿主半边 ESM
  lib/.build-manifest.json  产物清单：输入的 sha256，自检用它判断"源码改了没构建"
  package.json       包清单：exports{"./client"} + dsh.client{platform:"web"} + dsh.bundle.patch
  cordis.patch.yml   bundle 自带的补丁层：insert 一行把本插件接进 Loader
  tsconfig.json      src/ 的类型检查（classic JSX：jsxFactory = h）
  tsconfig.tools.json tools/ 的类型检查（Node 直接跑 .ts，故要求 erasableSyntaxOnly）
  AGENTS.md          工程约束：硬规则、不变量、改动流程
```

运行时**零依赖**：宿主半边不 import 任何东西；浏览器半边只 `require` 平台种子表里的
`react` / `react-dom` / `@deepseek-ai/dsh-client-ui-primitives`（种子表固化在 shell 里，
不需要 `dsh.client.external` 声明）。第三方包（目前只有 `@floating-ui/dom`，负责面板跟随）
在构建期被打进产物，运行期不依赖 `node_modules`。

## 改代码前

必须先读 [AGENTS.md](AGENTS.md)：那里写了三条各对应一次真实故障的硬规则（条目抛错即被退役、
Cordis 注入清单、HMR 读到半截文件）、不能改的不变量，以及"改完必须跑自检并看到 `全部通过 ✓`"
的流程。
