# dsh-superpowers

[简体中文](README.zh-CN.md)

> DeepSeek Harness × Superpowers: bring the complete superpowers methodology into DSH — install once, no per-session opt-in.

`dsh-superpowers` is a DeepSeek Harness (DSH) host-plugin adaptation of [obra/superpowers](https://github.com/obra/superpowers) **v6.3.0**: all 14 skills are vendored verbatim from upstream, the superpowers bootstrap is injected at the start of every session, and the DSH-native `skill` tool plus a slash-command family drive the full development workflow.

## Features

- **14 skills**: brainstorming, test-driven-development, systematic-debugging, writing-plans, executing-plans, subagent-driven-development, dispatching-parallel-agents, using-git-worktrees, verification-before-completion, requesting-code-review, receiving-code-review, finishing-a-development-branch, writing-skills, using-superpowers.
- **Automatic bootstrap injection**: at session start the plugin injects the full `using-superpowers` skill plus the DSH tool mapping, so the model walks the brainstorming → planning → TDD → debugging → verification workflow before writing code (the DSH equivalent of Claude Code's SessionStart hook).
- **Native skill catalog**: skills register through `ctx.skills` into each session's `<available_skills>` catalog and load with the native `skill` tool, exactly like any other skill.
- **DSH tool mapping**: `skills/using-superpowers/references/dsh-tools.md` translates the skills' action vocabulary into DSH tools (`skill` / `read` / `write` / `edit` / `grep` / `glob` / `bash` / `todo_write` / `subagent` / `subagent_fork` / `workflow` / `/plan`+`exit_plan_mode` / `web_search` / `ask_user_question`, …).
- **Slash-command family**: typing `/` reveals `/superpowers [skill] [your request]` plus 14 per-skill commands (both flat names and `/superpowers-<skill>` prefix-filtered forms). Skill commands use an input claim flow: **picking one keeps the command in the input box instead of sending immediately**, so you can type your request and press Enter to send the skill gesture together with your message.
- **Optional agent preset**: `preset/superpowers` appears as a "Superpowers" mode in the new-session preset picker.
- **Zero runtime dependencies**: `lib/` ships prebuilt; installing from GitHub runs `prepare` which rebuilds automatically.

## Installation

### Option 1: dsh command (recommended)

```sh
dsh plugin --profile web add github:stillU/dsh-superpowers
```

`dsh plugin --profile <name> ...` forwards its arguments to pnpm inside the profile: pnpm fetches the source, runs `prepare` to build `lib/`, adds the dependency and appends the bundle to `dsh.profile.bundles` automatically.

pnpm >= 10 refuses to run git-dependency build scripts by default. If the first install fails, allow the build key in the profile's `pnpm-workspace.yaml` and retry:

```yaml
allowBuilds:
  dsh-superpowers: true
```

It is recommended to pin a commit: `dsh plugin --profile web add github:stillU/dsh-superpowers#<commit-sha>`.

Restart **dsh web** after installing. Verify with `dsh --profile web --dump-config` — a `dsh-superpowers` config layer should appear.

## Usage

- New sessions automatically list the 14 superpowers skills in the catalog; the model checks for a relevant skill before acting.
- Type `/` to open the command family: `/superpowers` shows the overview, `/brainstorming` and the other skill commands invoke a skill (type your request after the command and press Enter to send them together).
- To use the "Superpowers" session mode, copy `preset/superpowers` to `$DSH_HOME/.agent-presets/`, restart, and select it in the new-session preset picker.

## Configuration

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | Master switch |
| `providerName` | `superpowers` | Skills provider name |
| `bootstrapSection.enabled` | `true` | Inject the session-start bootstrap |
| `bootstrapSection.order` | `45` | System-prompt section order |
| `commands.enabled` | `true` | Register the slash-command family |
| `commands.perSkill` | `true` | Register the 14 per-skill commands |

Override per-row in the profile's `cordis.patch.yml` (`- id: superpowers / name: dsh-superpowers / config: {...}`; an override must restate every key you want to keep).

## Uninstall

```sh
dsh plugin --profile web remove dsh-superpowers
```

## Credits & License

This project is a faithful port of the original work — **credit to the original author**:

- **Superpowers**: [obra/superpowers](https://github.com/obra/superpowers) by **Jesse Vincent** (obra), MIT License. All skill bodies are vendored verbatim (the only addition is the DSH tool-mapping reference file), following upstream's [porting-to-a-new-harness](https://github.com/obra/superpowers/blob/main/docs/porting-to-a-new-harness.md) guide.
- Upstream skill content stays © Jesse Vincent; see [LICENSE](LICENSE) and [NOTICE](NOTICE). Provenance is recorded in [SOURCES.md](SOURCES.md).
- The DSH adaptation (package manifest, bootstrap injection, skills provider, command family, agent preset, scripts) is maintained by [stillU](https://github.com/stillU), distributed under the MIT License, © 2026 stillU.

## Links

- Upstream: <https://github.com/obra/superpowers>
- This repository: <https://github.com/stillU/dsh-superpowers>
- DeepSeek Harness: <https://deepseek-harness.github.io/deepseek-harness/>