# dsh-superpowers

[English](README.md) | [简体中文](README_zh-CN.md)

> DeepSeek Harness × Superpowers：把 obra/superpowers 的完整技能方法论搬进 DSH，装完即用，无需每会话手动开启。

`dsh-superpowers` 是 [obra/superpowers](https://github.com/obra/superpowers) **v6.3.0** 面向 [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/)（DSH）的宿主插件适配：14 个技能逐字 vendor 自上游，每次会话自动注入 superpowers bootstrap，用 DSH 原生 `skill` 工具与斜杠命令家族驱动完整开发工作流。

## 功能特性

- **14 个技能**：brainstorming、test-driven-development、systematic-debugging、writing-plans、executing-plans、subagent-driven-development、dispatching-parallel-agents、using-git-worktrees、verification-before-completion、requesting-code-review、receiving-code-review、finishing-a-development-branch、writing-skills、using-superpowers。
- **bootstrap 自动注入**：会话开始时自动注入 `using-superpowers` 全文 + DSH 工具映射，模型在写代码前自动进入 brainstorming → 计划 → TDD → 调试 → 验收 的工作流（等价 Claude Code 的 SessionStart hook）。
- **技能目录原生可用**：技能通过 `ctx.skills` 注册进每个会话的 `<available_skills>` 目录，用 DSH 原生 `skill` 工具加载，与任何其他技能完全同体验。
- **DSH 工具映射**：`skills/using-superpowers/references/dsh-tools.md` 把技能的动作词汇翻译为 DSH 工具（`skill` / `read` / `write` / `edit` / `grep` / `glob` / `bash` / `todo_write` / `subagent` / `subagent_fork` / `workflow` / `/plan`+`exit_plan_mode` / `web_search` / `ask_user_question` 等）。
- **斜杠命令家族**：输入 `/` 即可见 `/superpowers [技能名] [诉求]` 总览与 14 个技能命令（平铺直达与 `/superpowers-<技能名>` 前缀过滤补全两种形态）。技能命令带输入提示：**选中后命令保留在输入栏不会立即发送**，继续输入你的诉求再回车，技能正文随消息一起注入会话。
- **可选 agent preset**：`preset/superpowers` 可作为「Superpowers」模式出现在新会话预设选择器中。
- **零运行时依赖**：`lib/` 为编译产物随包分发，GitHub 安装时 `prepare` 自动构建。

## 安装

### 方式一：dsh 命令（推荐）

```sh
dsh plugin --profile web add github:stillU/dsh-superpowers
```

`dsh plugin --profile <name> ...` 会把参数转发给 profile 内的 pnpm：pnpm 拉取源码并运行 `prepare` 自动构建 `lib/`，再写入依赖并自动追加 `dsh.profile.bundles`。

pnpm >= 10 默认拒绝运行 git 依赖的构建脚本，首次安装失败时，把包键加入该 profile 的 `pnpm-workspace.yaml` 后重试：

```yaml
allowBuilds:
  dsh-superpowers: true
```

建议锁定 commit：`dsh plugin --profile web add github:stillU/dsh-superpowers#<commit-sha>`。

安装后**重启 dsh web** 即可生效；验证：`dsh --profile web --dump-config` 应出现 `dsh-superpowers` 配置层。

## 使用

- 新会话自动出现 14 个 superpowers 技能目录，模型会先检查相关技能再行动；
- 输入 `/` 使用命令家族：`/superpowers` 查看总览，`/brainstorming` 等直接调用技能（可继续输入诉求后回车一起发送）；
NaN

## 配置

| 键 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 整体开关 |
| `providerName` | `superpowers` | skills provider 名称 |
| `bootstrapSection.enabled` | `true` | 是否注入会话起始 bootstrap |
| `bootstrapSection.order` | `45` | 系统提示词段顺序 |
| `commands.enabled` | `true` | 是否注册斜杠命令家族 |
| `commands.perSkill` | `true` | 是否注册 14 个技能命令 |

在 profile 的 `cordis.patch.yml` 中按 id 覆写（`- id: superpowers / name: dsh-superpowers / config: {...}`，覆写需重述全部键）。

## 卸载

```sh
dsh plugin --profile web remove dsh-superpowers
```

## 致谢与许可

本项目是对上游的忠实移植，**鸣谢原作者**：

- **Superpowers**：[obra/superpowers](https://github.com/obra/superpowers)，作者 **Jesse Vincent**（obra），MIT 许可。全部技能正文逐字 vendor（仅新增 DSH 工具映射文件），移植遵循其 `docs/porting-to-a-new-harness.md` 规约。
- 技能内容版权归上游作者所有，见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)；溯源信息见 [SOURCES.md](SOURCES.md)。
- DSH 适配（package manifest、bootstrap 注入、技能 provider、命令家族、agent preset、脚本）由 [stillU](https://github.com/stillU) 维护，MIT 许可，© 2026 stillU。

## 相关链接

- 上游：<https://github.com/obra/superpowers>
- 本仓库：<https://github.com/stillU/dsh-superpowers>
- DeepSeek Harness：<https://deepseek-harness.github.io/deepseek-harness/>