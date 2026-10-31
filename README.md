# opencode-tui-extension

opencode TUI 常驻状态插件：在终端界面固定位置显示 agent 写入的状态文本（如迁移看板 URL）。同时兼容 opencode v1 与 v2，一套数据、双端渲染。

## 功能

- **底部横幅**：显示 `<项目>/.opencode/status.txt` 首行，常驻可见、不随侧栏收起
- **侧栏区块**：显示 `<项目>/.opencode/sidebar.txt` 逐行内容（多行），与内置 Context/MCP 等区块并列
- **agent 驱动**：任何 agent / skill / 人工写这两个文件即可更新显示；插件通过文件监听（fs.watch）近实时刷新（约 50ms），5 秒轮询兜底，无需重启 opencode
- **语义**：文件不存在 → 显示默认值；文件为空 → 隐藏

## v1 / v2 兼容

一个 npm 包，两个入口，共用 `common/`（常量与读取逻辑）：

| | v1（opencode-ai，如 1.19.x） | v2（@opencode/cli） |
|---|---|---|
| 入口 | `v1/entry.tsx`，默认导出 `{ id, tui }` | `tui.tsx`，`Plugin.define({ id, setup })` |
| 注册 | `tui.json` 的 `plugin`（file:// 指向 v1 入口） | `cli.json` 的 `plugins`（包名，读 `exports["./tui"]`） |
| 横幅槽位 | `app_bottom`（全局底栏） | `prompt.footer.status`（输入框下方状态行） |
| 侧栏槽位 | `sidebar_content` | `sidebar.content` |

数据文件两代完全共用：写一次，v1/v2 同时显示。修改注册后需重启对应 TUI 生效。

## 安装与使用

### 模块一：npm 安装（包已发布到 registry，新机推荐）

```powershell
# 新机一行：npx 自动拉包运行，init 内部自动 npm i -g 装成全局命令并注册、写横幅
npx opencode-tui-extension init "看板地址：127.0.0.1:8080"

# 或显式两步
npm i -g opencode-tui-extension
opencode-tui-extension.cmd init "看板地址：127.0.0.1:8080"
```

（macOS / Linux 去掉 `.cmd` 后缀：`npx opencode-tui-extension init "..."`）

### 模块二：本地开发（未发布 / 仓库直装）

```powershell
cd opencode-tui-extension
node bin\status.mjs init "看板地址：127.0.0.1:8080"
# init 检测全局未装时：registry 无此包则自动回退 npm link，把当前仓库挂成全局命令
```

### 日常使用（两种安装方式完成后完全一致）

```powershell
opencode-tui-extension.cmd set "http://127.0.0.1:8080"          # 改横幅（即时生效）
opencode-tui-extension.cmd sidebar "line1\nline2"               # 开侧栏（多行）
opencode-tui-extension.cmd clear                                # 隐藏
opencode-tui-extension.cmd doctor                               # 诊断
# macOS/Linux 直接 opencode-tui-extension <命令>
```

注册生效需重启一次 opencode（v1 硬性）；此后 `set`/`sidebar`/`clear` 即时生效、无需重启。

注意（Windows）：全局命令与 npx 都必须走 `.cmd` 调用，`.ps1` 垫片会被执行策略拦截。

## CLI 命令一览

| 命令 | 作用 |
|---|---|
| `init [text] [--v1 --v2]` | **一键**：自动安装（`npm i -g`，registry 缺失时回退 `npm link`）+ setup + 默认开启底部横幅（侧栏默认隐藏） |
| `setup [--v1 --v2]` | 仅注册到对应版本的配置文件，幂等 |
| `set <text>` | 写横幅（status.txt 首行显示） |
| `sidebar <text>` | 写侧栏（sidebar.txt 逐行显示，`\n` 换行） |
| `clear [status\|sidebar\|all]` | 置空文件即隐藏，默认 all |
| `doctor` | 诊断：版本探测、注册状态、槽位内容、TUI 加载标记 |

## 目录结构

```
├── common/constants.js   # 常量唯一来源（双运行时共享：Bun 插件 / Node CLI）
├── common/utils.ts       # 读取逻辑（readSlotFile / firstLine）
├── tui.tsx               # v2 入口
├── v1/entry.tsx          # v1 入口（子目录无 package.json，file:// 直载）
└── bin/status.mjs        # CLI（零依赖 node）
```

## 集成示例

d2h 迁移看板（d2h-dashboard skill）已在 URL 确认/端口漂移时调用 `set <url>`，停止看板时 `clear`，实现看板地址常驻 TUI。
