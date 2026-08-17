# dsh-superpowers

> DeepSeek Harness × Superpowers：把 obra/superpowers 的完整技能方法论搬进 DSH，装完即用，无需每会话手动开启。

`dsh-superpowers` 是 [obra/superpowers](https://github.com/obra/superpowers) **v6.3.0**（2026-08-12，origin/main `b36e0829c6d0140e93cfef2ca599b1b07d4a7797`）面向 [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/)（DSH）的宿主插件适配：

- 14 个技能**逐字 vendor** 自上游（含 scripts/references 附属文件），平台无关正文一字不改；
- 每次会话**自动注入** superpowers bootstrap（等价 Claude Code 的 SessionStart hook）；
- 技能进会话技能目录、用 DSH 原生 `skill` 工具加载，与任何其他技能完全同体验；
- 提供一套**斜杠命令家族**（`/superpowers` 总览 + 14 个技能命令，选中后留在输入栏、连同你的诉求一起发送）。

## 特性

- **14 个技能**：brainstorming、test-driven-development、systematic-debugging、writing-plans、executing-plans、subagent-driven-development、dispatching-parallel-agents、using-git-worktrees、verification-before-completion、requesting/receiving-code-review、finishing-a-development-branch、writing-skills、using-superpowers。
- **bootstrap 自动注入**：以系统提示词段 order 45（persona 0 与 plan-policy 50 之间）注入上游 `using-superpowers` 全文 + DSH 工具映射，模型在写代码前自动进入 brainstorming → 计划 → TDD → 调试 → 验收 的工作流。
- **DSH 工具映射**：`skills/using-superpowers/references/dsh-tools.md`。技能正文平台无关，动作词汇按上游规约经映射翻译为 DSH 工具（`skill` / `read` / `write` / `edit` / `grep` / `glob` / `bash` / `todo_write` / `subagent` / `subagent_fork` / `workflow` / `/plan`+`exit_plan_mode` / `web_search` / `ask_user_question` 等）。
- **斜杠命令家族**：`/superpowers [skill] [你的诉求]` 总览/按名调用 + 14 个技能命令（平铺直达与 `/superpowers-<技能名>` 前缀过滤补全两种形态）。技能命令带输入提示（claim 流）：**选中后不会立即发送**，命令保留在输入栏，你可继续输入诉求，回车后 `/技能名` + 诉求一起作为用户消息提交，平台原生手势自动把技能正文注入会话。
- **可选 agent preset**：`preset/superpowers` 作为「Superpowers」模式出现在新会话预设选择器，适合只在指定会话使用完整方法论。
- **零运行时依赖、零构建安装**：`lib/` 为编译产物随包分发（GitHub 安装时 `prepare` 会自动重新构建源码）。

## 要求

- Node.js >= 20（推荐 22/24）；DSH RC.6+，任意 profile（`web` / `dsh-tui` / 其他）
- 无运行时第三方依赖

## 安装

以下命令均以 `web` profile 为例；`dsh plugin --profile <name> ...` 会把参数转发给 profile 内的 pnpm 并自动写入 `dsh.profile.bundles`。

### 方式一：从 GitHub 安装（推荐）

```sh
dsh plugin --profile web add github:stillU/dsh-superpowers
```

GitHub 安装拉取的是源码；本包已提供 `prepare`（`tsc`）自动构建 `lib/`。pnpm >= 10 默认拒绝运行 git 依赖的构建脚本，首次安装会失败并提示——把包键加入该 profile 的 `pnpm-workspace.yaml` 后重试：

```yaml
# 文件：$DSH_HOME/profiles/web/pnpm-workspace.yaml
allowBuilds:
  dsh-superpowers: true
```

建议锁定 commit（避免上游推送悄悄改变实际运行内容）：

```sh
dsh plugin --profile web add github:stillU/dsh-superpowers#<commit-sha>
```

### 方式二：本地目录 / tarball（零构建授权）

```sh
dsh plugin --profile web add ./dsh-superpowers          # 本地目录（pnpm link）
# 或先打包再安装：
pnpm pack                                             # 得到 dsh-superpowers-6.3.0.tgz
dsh plugin --profile web add ./dsh-superpowers-6.3.0.tgz
```

### 方式三：一键脚本（本地开发/维护用）

```sh
node scripts/install.mjs --help                # 查看参数
node scripts/install.mjs                       # dry-run，预览将执行的命令
node scripts/install.mjs --profile web --yes   # 实际安装
node scripts/install.mjs --yes --preset        # 安装 + 复制 Superpowers 预设
```

### 重启与验证

宿主插件在启动时加载：**安装后必须彻底重启 dsh web**（确认旧进程已退出、3080 端口未被占用，否则新进程起不来、看起来像“没生效”）。

```sh
dsh --profile web --dump-config   # 应出现 "# == dsh-superpowers" 配置层
```

启动后终端会打印一行诊断横幅：

```
[dsh-superpowers] loaded -> skillsDir=... skills=14 commands=true/true bootstrap=yes provider=injected systemPrompt=injected commandsMount=injected
```

`skills=14` 且三处均为 `injected` 即加载成功。

## 配置

在 **profile 的 `cordis.patch.yml`** 中按 id 整体覆写（patch 按 id 替换整行 config，**必须重述要保留的全部键**）：

```yaml
# 文件：$DSH_HOME/profiles/web/cordis.patch.yml
- id: superpowers
  name: dsh-superpowers
  config:
    enabled: true
    providerName: superpowers
    # skillsDir: C:/path/to/another/skills    # 可选：覆盖内置技能目录
    bootstrapSection:
      enabled: true
      order: 45
```

| 键 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 整体开关；false 时插件不注册任何内容 |
| `providerName` | `superpowers` | skills provider 名称（同名冲突时可改） |
| `skillsDir` | 包内 `skills/` | 技能目录覆盖（一般无需设置） |
| `bootstrapSection.enabled` | `true` | 是否注入会话起始 bootstrap |
| `bootstrapSection.order` | `45` | 系统提示词段顺序（0 persona / 50 plan / 100–199 工具引导） |
| `commands.enabled` | `true` | 是否注册斜杠命令家族 |
| `commands.perSkill` | `true` | 是否注册 14 个技能各自的命令；false 时仅保留 `/superpowers` |

关闭全局 bootstrap（只保留技能目录）示例：

```yaml
- id: superpowers
  name: dsh-superpowers
  config:
    enabled: true
    providerName: superpowers
    bootstrapSection:
      enabled: false
      order: 45
```

配置变更会触发插件 HMR 热替换（若 profile 启用了 hmr），否则重启 dsh web 生效。

## 使用

1. 新会话自动出现技能目录（14 个 superpowers 技能及其描述）；模型会先在响应/行动前检查相关技能，用 `skill` 工具加载——bootstrap 已注入 `using-superpowers` 全文，模型应直接遵循、不重复加载它。
2. 手动查看技能与状态：输入 `/superpowers`。
3. 工具映射参考：`skills/using-superpowers/references/dsh-tools.md`。

### 斜杠命令家族

Web UI 输入 `/` 会列出全部命令（含其他插件的 `/plan` 等）：

| 命令 | 作用 |
|---|---|
| `/superpowers` | 总览：列出 14 个技能与 bootstrap 状态 |
| `/superpowers <技能名> [诉求]` | 调用指定技能（如 `/superpowers brainstorming 帮我拆解需求`） |
| `/brainstorming` 等 14 个 | 分别调用对应技能 |
| `/superpowers-brainstorming` 等 14 个 | 前缀命名空间形态：输入 `/superpowers-` 后技能名继续平铺、可随输入过滤补全 |

技能命令带输入提示（claim 流）：**选中后命令保留在输入栏，不会立即发送**；继续输入你的诉求再回车，插件会把 `/技能名` + 你的文字作为一条用户消息提交，平台原生技能手势随即把技能正文注入会话。`/superpowers -<技能名> <诉求>` 写法同样支持。

可用 `commands.enabled: false` 关闭整个命令家族，或 `commands.perSkill: false` 只保留 `/superpowers`。

### 使用 Superpowers agent preset（可选）

```powershell
Copy-Item -Recurse preset/superpowers $env:USERPROFILE\.dsh\.agent-presets\superpowers
# 或: node scripts/install.mjs --yes --preset
```

重启 dsh web 后，新会话预设选择器中会出现 **Superpowers**（完整 bootstrap 注入 persona、独立 providerName 挂载同一批技能）。

## 验收清单

- [ ] `dsh --profile web --dump-config` 包含 dsh-superpowers 配置层且无加载错误；
- [ ] 新会话技能目录包含 14 个 superpowers 技能；`skill` 工具可加载 `brainstorming`；
- [ ] 提问 “describe your superpowers”，模型能说出已加载 bootstrap 与技能体系；
- [ ] 干净会话发送 **“Let's make a react todo list”**，模型应在写任何代码前先触发 `brainstorming`（上游官方验收标准）；
- [ ] `/superpowers` 输出 14 个技能与 bootstrap 状态；
- [ ] `bootstrapSection.enabled: false` 后新会话仅保留技能目录、不再注入 bootstrap。

## 卸载

```sh
dsh plugin --profile web remove dsh-superpowers
```

如安装过预设：删除 `$DSH_HOME/.agent-presets/superpowers`。然后重启 dsh web。（经 dshmarket 安装时也可在界面中移除。）

## 更新

1. 拉取上游新版本（`superpowers/` 检出更新到目标提交）；
2. `node scripts/vendor-skills.mjs`（复制 + 字节校验 + 更新 SOURCES.md）；
3. `node scripts/vendor-skills.mjs --validate`（幂等校验）；
4. `node scripts/generate-preset.mjs`（重建 preset）；
5. `node --test "tests/**/*.test.mjs"`（回归）；
6. 重新安装（`dsh plugin --profile web add .` / tarball / github 指向新 commit）并重启。

## 故障排查

- **技能/命令未出现**：看启动横幅 `[dsh-superpowers] loaded -> ...`。`skills=` 为 0 说明技能目录不可读；`provider=`/`systemPrompt=`/`commandsMount=` 显示 `no-service`/`failed` 说明对应服务挂载时机异常（正常均为 `injected`）。修改插件或配置后请**彻底重启** dsh web（确认 3080 端口无旧进程残留）。
- **命令家族不完整**：只看到 `/superpowers` 说明 `commands.perSkill` 被覆写为 false 或技能目录为空；个别命令缺失、其余正常，说明命令名与既有命令冲突（终端打印 `failed to register /<name>`），可改名或关闭冲突一方。
- **bootstrap 未出现**：确认 `bootstrapSection.enabled` 未被覆写；日志出现 `[dsh-superpowers] bootstrap not injected` 时检查 `skills/using-superpowers/SKILL.md` 与 `references/dsh-tools.md` 是否完整。
- **与「梁神模式」默认预设共存**：liangshen 的 phase-1 会把系统提示词段裁剪到仅 persona、晋升后才恢复其余段，因此 bootstrap 段 phase-1 不可见、晋升后自动出现，属预期行为。
- **GitHub 安装首次失败**：pnpm >= 10 需要先在 profile 的 `pnpm-workspace.yaml` 允许构建（见安装方式一），再重试。

## 致谢与许可

本项目是对上游的忠实移植，**鸣谢原作者**：

- **Superpowers 项目**：[obra/superpowers](https://github.com/obra/superpowers)，作者 **Jesse Vincent**（obra），MIT 许可。本插件的全部技能正文、hooks 规约与 porting 方法论均源自该项目；`docs/porting-to-a-new-harness.md` 是本适配遵循的移植指南。
- **技能内容**：`skills/` 自上游 v6.3.0 逐字 vendor（字节级校验），仅新增 `references/dsh-tools.md` 工具映射（其规范副本在 `references/dsh-tools.md`）；上游版权归 Jesse Vincent 所有，见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。
- **DSH 适配**（package manifest、bootstrap 注入、技能 provider、命令家族、agent preset、脚本）：由 [stillU](https://github.com/stillU) 维护，MIT 许可分发，© 2026 stillU。适配过程由 AI 编程助手协助完成，所有改动均适配 DSH 平台 API。
- 溯源信息见 [SOURCES.md](SOURCES.md)（上游 SHA、vendor 校验与版本）。

## 相关链接

- 上游：<https://github.com/obra/superpowers>
- 本仓库：<https://github.com/stillU/dsh-superpowers>
- DeepSeek Harness：<https://deepseek-harness.github.io/deepseek-harness/>