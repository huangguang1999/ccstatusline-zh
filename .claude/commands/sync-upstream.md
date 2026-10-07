---
description: 同步上游 sirmalloc/ccstatusline release 或 main 到 fork 并完成中文化
argument-hint: "<upstream-tag 或 main，例如 v2.2.30>"
---

# Sync upstream ccstatusline release

把上游 sirmalloc/ccstatusline 的新 release `$ARGUMENTS` 同步到当前 fork，
保持 fork 的中文化风格、包名重命名、测试全绿，最后开 PR。

**不要自动 merge PR，不要自动 npm publish——这两步由用户人工执行。**

## 硬约束（每次 sync 不变）

### Fork 与上游的差异点

包名 `ccstatusline` → `ccstatusline-zh`，触点：

| 文件 | 改什么 |
| --- | --- |
| `package.json` | `name`, `bin`, `description`, `repository`, `keywords` |
| `src/utils/claude-settings.ts` | `CCSTATUSLINE_COMMANDS`、`PINNED_INSTALL_COMMANDS` 所有字符串 |
| `src/utils/update-checker.ts` | `NPM_REGISTRY_LATEST_URL`、`User-Agent`、安装 args |
| `src/utils/global-package-manager.ts` | 二进制路径模板（`appendPathSegment(..., 'ccstatusline-zh${ext}')`）、根目录查找、`'ccstatusline'` 字面量 |
| `src/utils/global-command-resolution.ts` | `getCommandResolutionPaths('ccstatusline-zh', ...)`、bunx transient regex |

### 中文化范围

**翻译**：
- Widget 的 `getDisplayName()` / `getCategory()` / `getDescription()`
- Widget render 输出的 label（如 `'Session: '` → `'会话: '`，`'周 Opus: '`）
- TUI 组件里的菜单项、screen 标题、prompt 文本、错误/警告
- ConfirmDialog 消息、FlashMessage 文本、FlowNotice
- 测试断言里 expectedModifierText / expectedTime / 文案匹配

**保留英文**：
- Widget type ID 字符串字面量（`'voice-status'`, `'session-usage'`, `'weekly-opus-usage'` 等）
- config 键名、JSON 字段名
- 内部 API 函数名、类型名、commit message keys
- rawValue 输出（如 VoiceStatus 的 `'on'` / `'off'` 给 shell 脚本消费者用）
- 文件路径、import paths、所有 .ts/.tsx 文件名

### Fork 已采用的术语表

| 英文 | 中文 |
| --- | --- |
| Install / Uninstall | 安装 / 卸载 |
| Update / Check for Updates | 更新 / 检查更新 |
| Pinned global install | 固定全局安装 |
| Auto-update | 自动更新 |
| Manage Installation | 管理安装 |
| Configure Status Line | 配置状态行 |
| Continue / Cancel | 继续 / 取消 |
| Loading settings... | 正在加载设置... |
| (install first) | （请先安装） |
| (npm/bun/npx/bunx not installed) | （未检测到 npm/bun/npx/bunx） |
| Press Enter to select, ESC to go back | 按 Enter 选择，ESC 返回 |
| voice / Voice | 语音 |
| enabled / disabled | 启用 / 关闭 |
| Install Complete / Update Complete | 安装完成 / 更新完成 |
| Installed to Claude Code | 已安装到 Claude Code |
| Global package updated | 全局包已更新 |
| Install/Update/Uninstall failed | 安装/更新/卸载失败 |
| Self-managed/global install | 自管理 / 全局安装 |
| Unknown installation / Unknown or not installed | 未知安装方式 / 未知或未安装 |
| Choose what to remove | 请选择要移除的内容 |
| package manager | 包管理器 |
| Active PATH match | 当前 PATH 匹配 |
| ccstatusline（用户可见时） | ccstatusline-zh |

## 工作流

### 步骤 0：核对参数

确认 `$ARGUMENTS` 是合法的上游 tag（形如 `v2.2.30`）或 `main`。如果用户传的是版本号没带 `v`，加上。同步 `main` 时，以 fetch 后的 `upstream/main` 完整提交号作为目标，并在 README 中记录。

> **为什么用 git cherry-pick 而不是 jj rebase**：本 fork 的历史是「每次同步
> squash 成一个 `feat: 同步上游 …` 提交」，与上游的 merge-base 停在很早的位置。
> 直接 `jj rebase -d main@upstream` / `git rebase` 会把 fork 全部历史重放到上游
> 之上，产生大量虚假冲突。正确做法是只 cherry-pick 上游「上次同步点 → 目标 tag」
> 这一段增量。

### 步骤 1：拉上游 + 起 sync 分支

```bash
git remote get-url upstream >/dev/null 2>&1 || \
  git remote add upstream https://github.com/sirmalloc/ccstatusline.git
git fetch upstream --tags
git checkout -b sync/upstream-$(date +%Y-%m-%d) origin/main
```

### 步骤 2：定位增量并 cherry-pick

优先读取 README 顶部记录的「上次同步的完整上游提交」，作为 cherry-pick 起点。
中文包版本号与上游独立递增，不能通过当前 `package.json` version 推断同步基线。
只有 README 没有记录完整提交号时，才结合历史同步提交和上游 tag 核实起点：

```bash
# 核对历史同步记录与对应的上游版本
git log --oneline <range> -- package.json
git show <commit>:package.json | grep '"version"'
```

确定起点 `<base>` 后取增量（注意上游 PR 多为 squash，一般没有 merge commit）：

```bash
git log --oneline --reverse <base>..$ARGUMENTS   # 先看清这次要同步哪些提交
git cherry-pick <base>..$ARGUMENTS
```

### 步骤 3：解冲突

cherry-pick 在每个有冲突的 commit 停下。决策规则：

1. **文件 fork 仅改了 UI 字符串，上游也只改了同一处字符串** → 保留 fork 中文版
2. **文件上游加了新逻辑 + fork 仅改了字符串** → 合并：保留新逻辑 + 把新加的英文按术语表翻译
3. **文件是上游新增的（fork 还没有）** → 取上游版本，扫描其中所有用户可见字符串翻译
4. **大规模重构冲突**（上游把整个文件结构改了）→ 停下来问用户

`package.json` 的版本冲突：保留 fork 的包名、描述和安装入口，合入上游依赖变化；中文包版本按当前中文版本递增，不能被上游版本覆盖或降低。
`README.md` 冲突：fork 的 README 是全中文自定义结构，一律保留 fork 侧
（`git checkout --ours README.md`），版本相关信息在步骤 6 手动更新。

解完一个文件 `git add`，继续 `git cherry-pick --continue`（用 `-c core.editor=true`
跳过编辑器）。cherry-pick 干净落地后，再去翻译那些「无冲突但是上游新增的英文」。

### 步骤 4：包名一致化扫描

```bash
grep -rn --include="*.ts" --include="*.tsx" --include="*.json" \
  "['\"]ccstatusline['\"\\$]" src/ package.json
```

逐项判断：
- 用户可见路径（command、shell args、URL、display text）→ 改成 `ccstatusline-zh`
- 内部代码引用、文件路径、source 注释 → 不改

### 步骤 5：测试

```bash
bun install
bun run lint                 # typecheck + eslint，必须通过
env -u HTTPS_PROXY -u HTTP_PROXY -u ALL_PROXY \
    -u https_proxy -u http_proxy -u all_proxy \
    bun test                 # 期望全绿
```

测试失败常见原因：
- 测试断言里有英文 UI 字符串没翻译 → 翻成中文
- 测试期望 `ccstatusline@x.y.z` → 改成 `ccstatusline-zh@x.y.z`
- `usage-fetch.test.ts` 超时 → 是本地代理 flake，单独再跑一次确认

### 步骤 6：README + 版本号一致

- `package.json` 使用独立递增的中文包版本号
- `README.md`：
  - 顶部「同步至上游 vX.Y.Z」一行
  - 「上次同步的完整上游提交」和本次核对日期
  - 「关于本项目」章节里如果有版本特性列表，补一行 `$ARGUMENTS` 新增功能
  - 「与上游的差异」表格中「同步版本」单元格
  - 「可用组件」表格：如果上游加了新 widget，补到对应类别
  - 「TUI 主菜单功能」：如果加了新菜单项，补充
  - 组件总数：`grep -l "implements Widget" src/widgets/*.ts | wc -l` 拿实际数

### 步骤 7：push + 开 PR

```bash
git push -u origin sync/upstream-$(date +%Y-%m-%d)
gh pr create --base main \
  --head "sync/upstream-$(date +%Y-%m-%d)" \
  --title "feat: 同步上游 ccstatusline $ARGUMENTS 并完成中文化" \
  --body-file /tmp/sync-pr-body.md
```

PR body 模板（写到 `/tmp/sync-pr-body.md`）：

```markdown
## Summary
- 同步上游 sirmalloc/ccstatusline 至 `$ARGUMENTS`
- 中文化新增内容（具体列项）
- 包名同步（如有）
- bun run lint / bun test 全绿

## 上游新增功能
（按 release notes 摘 3-5 条 highlight，每条一句中文）

## 中文化处理
（具体翻了哪些组件/菜单/widget，按 widget/TUI/error 分组）

## Test plan
- [x] bun run lint 通过
- [x] bun test 全绿（X 个测试）
- [ ] 真机 TUI 验证（merge 后用户跑）
- [ ] settings.json 兼容性

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

CI 自动同步场景（`upstream-sync.yml` 调用）：开完 PR 直接
`gh pr merge --auto --squash` 开启自动合并，CI 绿后自动合，发布交给 `release.yml`。

### 步骤 8：交接

PR 开好后：

- **CI 自动同步**（`upstream-sync.yml`）：已 `gh pr merge --auto --squash`，到此为止。
  CI 绿 → 自动合并 → `release.yml` 检测到版本号变化 → 在 `npm-publish`
  Environment 暂停等用户审批 → 批准后发布。
- **手动跑**：`gh pr checks <PR#> --watch` 看 CI，绿后把 PR URL 给用户，
  由用户 review + `gh pr merge --squash`。合并后发布同样交给 `release.yml`。

## 注意事项

- **用 git cherry-pick 取增量，不要 jj rebase / git rebase** —— 见步骤 1 上方说明
- **不要自己 merge PR，不要手动 npm publish** —— 合并交给 auto-merge + CI，
  发布交给 `release.yml`（含人工审批 gate）
- 遇到不知道怎么翻译的术语 → 查 fork 已有翻译先（`grep -rn '关键词' src/`）
- 遇到上游大规模重构 → 停下来：手动场景问用户，CI 场景开 issue 通知后停止
- lint 错误不要用 `eslint-disable` 注释绕过 —— 项目 CLAUDE.md 硬约束，改源码
- typecheck + lint 统一跑 `bun run lint`，不要直接 `bun tsc` / `npx eslint`
