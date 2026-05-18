# ccstatusline-zh

**🎨 Claude Code CLI 高度可定制状态栏格式化工具 — 中文汉化版**

_在终端中显示模型信息、Git 分支、Token 用量及其他实时指标_

> 本项目是 [ccstatusline](https://github.com/sirmalloc/ccstatusline) 的**中文汉化 Fork**，当前同步至上游 v2.2.19 版本（含 Voice Status、版本固定全局安装、Jujutsu VCS、CompactionCounter、超额用量组件、Git 子进程缓存等最新功能）。所有用户可见的界面文本（组件名称、分类、描述、菜单标签、提示信息等）均已翻译为中文，方便中文用户使用。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/huangguang1999/ccstatusline-zh/blob/main/LICENSE)
[![Node.js Version](https://img.shields.io/node/v/ccstatusline.svg)](https://nodejs.org)

![Demo](https://raw.githubusercontent.com/huangguang1999/ccstatusline-zh/main/screenshots/demo.gif)

## 📚 目录

- [关于本项目](#-关于本项目)
- [功能特性](#-功能特性)
- [快速开始](#-快速开始)
- [Windows 支持](#-windows-支持)
- [使用方法](#-使用方法)
- [可用组件](#-可用组件)
- [配置界面（TUI）](#-配置界面tui)
- [API 文档](#-api-文档)
- [开发指南](#️-开发指南)
- [致谢](#-致谢)
- [许可证](#-许可证)

---

## 🌏 关于本项目

**ccstatusline-zh** 是 [ccstatusline](https://github.com/sirmalloc/ccstatusline) 的中文汉化版本。

ccstatusline 是一个优秀的 Claude Code CLI 状态栏格式化工具，支持 50+ 种可定制组件、Powerline 主题、交互式 TUI 配置界面等丰富功能。本项目在其基础上，将所有用户可见的英文文本直接替换为中文，包括：

- **72 个组件**的名称、描述、分类标签（含 v2.2.13 新增的 Voice Status / 周 Sonnet 用量 / 周 Opus 用量，v2.2.17 新增的超额用量占比 / 超额用量剩余）
- **TUI 配置界面**的全部菜单项、帮助文本、提示信息、对话框
- **布局组件**（分隔符、弹性分隔符）的名称和描述
- **极简模式 / Minimalist Mode**、**模糊搜索组件选择器**、**Powerline 主题色延续**（v2.2.8）
- **上下文窗口**、**Git 文件状态系列**（已暂存 / 未暂存 / 未跟踪 / 干净）、**短条形百分比模式**、**GitLab 支持**、**Reset Timer 时区/IANA 选择**、**TUI 环绕导航**、**`refreshInterval` 配置**（v2.2.10）
- **Jujutsu VCS 系列**（书签 / 工作区 / 根目录 / 变更 / 增删 / 描述 / 修订）、**CompactionCounter 压缩计数**、**用量时间游标**、**Reset Timer 绝对时间戳**、**Powerline 端帽数量解锁**、**思考力度组件 xhigh 等级**（v2.2.12）
- **Voice Status 语音状态组件**、**周 Sonnet / 周 Opus 用量组件**、**Timer 短进度条**、**Hook 输出静默**（v2.2.13）
- **版本固定全局安装**（Pinned global install）、**管理安装 / 检查更新菜单**、**npm 仓库更新检测**、**固定安装版本不一致防错屏幕**（v2.2.14–v2.2.16）
- **超额用量占比 / 超额用量剩余组件**（按量付费月度超额额度，支持禁用时隐藏）、**用量 API 空值桶兼容**、**Git 命令旧版本兼容与 `--no-optional-locks` 锁规避**（v2.2.17–v2.2.18）
- **Git 子进程输出持久化缓存**（可配置 TTL，按 `.git/HEAD` / `.git/index` mtime 失效）、**`CCSTATUSLINE_WIDTH` 终端宽度覆盖**、**固定全局安装设为默认安装项**、**Windows 隐藏辅助进程窗口**（v2.2.19）
- **确认对话框** "是 / 否"
- **分类筛选** "全部" 等界面元素

内部标识符（如 settings.json 中的 widget type ID `"model"`、`"git-branch"` 等）保持英文不变，确保与上游版本的配置文件完全兼容。

### 与上游的差异

| 项目       | ccstatusline | ccstatusline-zh           |
| ---------- | ------------ | ------------------------- |
| 界面语言   | 英文         | 中文                      |
| 配置兼容性 | —            | ✅ 共用相同 settings.json |
| 功能差异   | —            | 无，功能完全一致          |
| 同步版本   | 最新         | v2.2.19（+ jj widgets / CompactionCounter / Voice Status / 版本固定安装 / 超额用量组件 / Git 子进程缓存 / 中文化覆盖） |

---

## ✨ 功能特性

- **50+ 种可定制组件** — 模型、Git（含 PR / 冲突 / 暂存 / Origin / Upstream / 工作树等细分组件）、Token、上下文、会话、费用、速度等
- **交互式 TUI 配置** — 按 `ccstatusline-zh setup` 启动可视化配置界面
- **Powerline 风格** — 内置多款 Powerline 主题，支持自定义分隔符，支持主题色跨行延续
- **极简模式** — 一键让所有组件切换到"无标签"模式，状态栏更精简
- **模糊搜索组件** — 添加组件时支持子串 / 首字母 / 模糊匹配，带实时高亮
- **Claude 账户邮箱** — 状态栏显示当前登录的 Claude 账户邮箱
- **多行布局** — 支持多行状态栏配置
- **实时预览** — 配置时即时预览效果
- **自定义颜色** — 每个组件支持独立的前景色和背景色设置
- **自定义命令 & 文本 & 符号** — 可嵌入自定义 Shell 命令输出、静态文本或单字符符号/Emoji
- **可点击链接** — 支持 OSC8 终端超链接（Git 分支、Git PR、仓库根目录等可配置）
- **跨平台** — 支持 macOS、Linux、Windows

---

## 🚀 快速开始

### 安装

通过 npm 全局安装：

```bash
npm install -g ccstatusline-zh
```

或者使用 Bun：

```bash
bun install -g ccstatusline-zh
```

> 💡 提示：v2.2.14 起 ccstatusline 增加了「固定版本全局安装」选项，TUI 中选择 **固定全局安装** 即可锁定当前版本，避免 `@latest` 跟随上游。详见 TUI 安装流程。

### 配置 Claude Code

在 Claude Code 设置中添加状态栏配置。编辑 `~/.claude/settings.json`：

```json
{
  "statusLine": {
    "type": "command",
    "command": "ccstatusline-zh",
    "padding": 0,
    "refreshInterval": 10
  }
}
```

如果使用 `npx` 或 `bunx` 运行，可以使用以下命令：

```json
{
  "statusLine": {
    "type": "command",
    "command": "npx -y ccstatusline-zh@latest",
    "padding": 0
  }
}
```

> `refreshInterval` 仅在 Claude Code ≥ 2.1.97 时生效，TUI 中可设置为 `1-60` 秒，留空则不写入该字段。
>
> 其他支持的 `command` 取值：
> - `bunx -y ccstatusline-zh@latest`
> - `ccstatusline-zh`（用于自管理 / 全局安装）
>
> 如需固定版本，可在 TUI 安装时选择「固定全局安装」，TUI 会全局安装当前版本并将 `command` 写为 `ccstatusline-zh`。

### 启动配置界面

```bash
ccstatusline-zh setup
```

这将打开交互式 TUI 配置界面，你可以：

- 添加、删除、重新排列组件
- 设置颜色和样式
- 选择 Powerline 主题
- 实时预览状态栏效果

---

## 🪟 Windows 支持

ccstatusline-zh 完整支持 Windows 系统。安装方式相同：

```bash
npm install -g ccstatusline-zh
```

Windows 下 Claude Code 的配置路径为 `%USERPROFILE%\.claude\settings.json`。

---

## 📖 使用方法

### 基本用法

安装并配置 statusLine 后，ccstatusline-zh 会在每次 Claude Code 更新状态时自动运行。状态数据通过 stdin 以 JSON 格式传入。

### 手动测试

```bash
cat scripts/payload.example.json | ccstatusline-zh
```

### 自定义配置文件路径

```bash
ccstatusline-zh --config /path/to/custom-settings.json
```

### 命令行参数

| 参数              | 说明                    |
| ----------------- | ----------------------- |
| `setup`           | 启动交互式 TUI 配置界面 |
| `--config <path>` | 指定自定义配置文件路径  |
| `--version`       | 显示版本号              |

---

## 🧩 可用组件

### 核心

| 组件     | 说明                                                  |
| -------- | ----------------------------------------------------- |
| 模型     | 显示当前 Claude 模型名称                              |
| 风格     | 显示当前输出风格                                      |
| 版本     | 显示 ccstatusline-zh 版本号                           |
| 思考力度 | 显示当前思考力度等级                                  |
| Vim 模式 | 显示当前 Vim 模式                                     |
| 语音状态 | 显示 Claude Code 语音输入是否启用（4 种格式 + Nerd 字体） |

### Git

| 组件                    | 说明                                           |
| ----------------------- | ---------------------------------------------- |
| Git 分支                | 显示当前 Git 分支名，支持 GitHub 链接          |
| Git PR                  | 显示当前分支的 PR 信息（链接、状态、标题）     |
| Git 变更                | 显示未提交的文件变更统计                       |
| Git 新增                | 显示未提交的新增行数                           |
| Git 删除                | 显示未提交的删除行数                           |
| Git 状态                | 汇总状态指示：+暂存 / *未暂存 / ?未跟踪 / !冲突 |
| Git 已暂存              | 存在已暂存变更时显示 +                         |
| Git 未暂存              | 存在未暂存变更时显示 *                         |
| Git 未跟踪              | 存在未跟踪文件时显示 ?                         |
| Git 冲突                | 显示合并冲突数量                               |
| Git 超前/滞后           | 显示相对 upstream 的提交领先/落后数            |
| Git SHA                 | 显示简短提交哈希                               |
| Git Origin 所有者/仓库  | 显示 origin 远程的 owner / repo                |
| Git Upstream 所有者/仓库 | 显示 upstream 远程的 owner / repo             |
| Git 是否 Fork           | 当仓库是 upstream 的 fork 时显示标识           |
| Git 根目录              | 显示 Git 仓库根目录名                          |
| Git 工作树              | 显示 Git 工作树信息                            |
| Git 工作树模式/名称/分支 | 工作树模式指示与详细信息                      |

### Token

| 组件       | 说明                |
| ---------- | ------------------- |
| 输入 Token | 显示输入 Token 数量 |
| 输出 Token | 显示输出 Token 数量 |
| 缓存 Token | 显示缓存 Token 数量 |
| 总 Token   | 显示 Token 合计     |

### Token 速度

| 组件     | 说明                        |
| -------- | --------------------------- |
| 输入速度 | 显示输入 Token 速度 (tok/s) |
| 输出速度 | 显示输出 Token 速度 (tok/s) |
| 总速度   | 显示总 Token 速度 (tok/s)   |

### 上下文

| 组件             | 说明                       |
| ---------------- | -------------------------- |
| 上下文长度       | 显示当前上下文 Token 数    |
| 上下文 %         | 显示上下文使用百分比       |
| 上下文 %（可用） | 显示可用上下文百分比       |
| 上下文进度条     | 以进度条形式显示上下文用量 |

### 会话

| 组件           | 说明                          |
| -------------- | ----------------------------- |
| 会话时钟       | 显示当前会话持续时间          |
| 会话费用       | 显示当前会话预估费用          |
| 会话名称       | 显示 Claude Code 会话名称     |
| 会话用量       | 显示会话 API 用量             |
| 周用量         | 显示本周 API 用量             |
| 周 Sonnet 用量 | 显示本周 Sonnet 模型 API 用量 |
| 周 Opus 用量   | 显示本周 Opus 模型 API 用量   |
| 超额用量占比   | 显示超额用量（按量付费）占比       |
| 超额用量剩余   | 显示每月超额用量额度的剩余金额（美元） |
| 时段计时器     | 显示当前 5 小时时段已用时间   |
| 时段重置计时   | 显示时段重置窗口剩余时间      |
| 周重置计时     | 显示周重置剩余时间            |
| Claude 会话 ID | 显示当前 Claude 会话 ID       |
| Claude 账户邮箱 | 显示当前登录的 Claude 账户邮箱 |
| 技能           | 显示 Claude Code 技能调用信息 |

### 环境

| 组件     | 说明                 |
| -------- | -------------------- |
| 当前目录 | 显示当前工作目录     |
| 终端宽度 | 显示终端列数         |
| 内存用量 | 显示系统内存使用情况 |

### 自定义

| 组件       | 说明                      |
| ---------- | ------------------------- |
| 自定义文本 | 显示用户自定义文本        |
| 自定义命令 | 执行 Shell 命令并显示输出 |
| 自定义符号 | 显示自定义单字符符号或 Emoji |
| 链接       | 显示可点击的终端超链接    |

### 布局

| 组件       | 说明                         |
| ---------- | ---------------------------- |
| 分隔符     | 组件之间的固定分隔符         |
| 弹性分隔符 | 自动填充剩余空间的弹性分隔符 |

---

## 🖥️ 配置界面（TUI）

运行 `ccstatusline-zh setup` 打开交互式配置界面。

### 主菜单功能

- **编辑状态栏** — 添加、删除、移动、配置组件
- **Powerline 设置** — 选择主题和自定义分隔符
- **全局样式覆盖** — 设置全局颜色和样式
- **终端选项** — 配置终端宽度和颜色级别
- **配置状态行** — 配置 Claude Code 状态行刷新间隔（Claude Code ≥ 2.1.97）
- **安装到 Claude Code** — 选择自动更新 / 固定全局安装两种方式
- **管理安装** — 已固定安装时可检查 npm 更新、运行全局更新命令、卸载
- **检查更新** — 查询 npm 仓库最新版本并对比当前版本

### 快捷键

| 按键    | 功能      |
| ------- | --------- |
| `↑` `↓` | 导航      |
| `Enter` | 选择/确认 |
| `a`     | 添加组件  |
| `d`     | 删除组件  |
| `e`     | 编辑组件  |
| `w`     | 组件选项  |
| `/`     | 搜索      |
| `q`     | 退出      |

---

## 📡 API 文档

详细的 API 文档和 JSON Payload 格式说明请参考上游项目：

👉 [ccstatusline API Documentation](https://github.com/sirmalloc/ccstatusline#-api-documentation)

---

## 🛠️ 开发指南

### 环境要求

- [Bun](https://bun.sh/) >= 1.0
- Node.js >= 14.0.0

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/huangguang1999/ccstatusline-zh.git
cd ccstatusline-zh

# 安装依赖
bun install

# 运行示例
bun run example

# 启动 TUI
bun run start setup

# 构建
bun run build

# 代码检查
bun run lint
```

### 项目结构

```
src/
├── ccstatusline.ts          # 入口文件
├── widgets/                 # 组件目录（72 个组件）
│   ├── Model.ts
│   ├── GitBranch.ts
│   ├── TokensInput.ts
│   ├── shared/              # 共享工具函数
│   └── ...
├── tui/                     # TUI 配置界面
│   ├── App.tsx
│   └── components/          # 界面组件
├── utils/                   # 工具函数
└── types/                   # 类型定义
```

---

## 🙏 致谢

- [ccstatusline](https://github.com/sirmalloc/ccstatusline) — 原始项目，由 [sirmalloc](https://github.com/sirmalloc) 开发维护
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — Anthropic 的 CLI 编码助手
- [Ink](https://github.com/vadimdemedes/ink) — React 终端渲染框架

---

## 📄 许可证

本项目遵循 [MIT 许可证](LICENSE)，与上游项目保持一致。

---

<div align="center">

**如果这个汉化版对你有帮助，欢迎 ⭐ Star！**

[上游项目](https://github.com/sirmalloc/ccstatusline) · [问题反馈](https://github.com/huangguang1999/ccstatusline-zh/issues)

</div>
