# DSH Tool Mapping

Skills speak in actions ("dispatch a subagent", "create a todo", "read a file"). On DeepSeek Harness (DSH) these resolve to the native tools below.

| Action skills request | DSH equivalent |
| --- | --- |
| Invoke a skill | `skill` — load the exact kebab-case skill name from DSH's session skill catalog |
| Read a file | `read` |
| Create, edit, or delete files | `write` / `edit` |
| Search file contents / find files by name | `grep` / `glob` |
| Run shell commands | `bash` (on Windows deployments DSH may surface a PowerShell-backed shell; use whichever shell tool the session lists) |
| Create a todo / track tasks | `todo_write` — send the ENTIRE list every call; it replaces the previous list |
| Dispatch a subagent / parallel agents | `subagent` / `subagent_fork` (background by default; set `run_in_background: false` when the next step depends on the result) |
| Scripted multi-agent fan-out | `workflow` — a JavaScript orchestrator that fans work out across many subagents |
| Team-of-agents workflows | `agent_teams_*` when the AgentTeams plugin is installed |
| Plan mode / plan review / approval gate | DSH's native `/plan` and `exit_plan_mode`; keep the skill's file-based plan documents as the artifact of record |
| Fetch a URL / research | `web_search` (DSH has no standalone webfetch tool; follow the skill's own fallback wording when research tools are missing) |
| Ask the user | `ask_user_question` |
| Run tests / git / verification | `bash` |

## Skills

DSH ships a native `skill` tool and a persistent session skill catalog that lists every model-invocable skill with its description. When a Superpowers instruction says to invoke a skill, call `skill` with the exact kebab-case name from that catalog before taking any action.

The `using-superpowers` skill is already loaded by the session bootstrap at startup — do NOT invoke the `skill` tool to load it again.

## Subagents

DSH provides `subagent` and `subagent_fork`, which run in the background by default and return a durable subagent id immediately. When a workflow needs the result before continuing, pass `run_in_background: false`. For large scripted fan-out, use `workflow`; when the AgentTeams plugin is installed, `agent_teams_*` provides durable multi-agent teams. Never invent a `Task` call — if no subagent tool is visible in the session, do the work inline or explain the missing capability.

## Task lists

DSH's `todo_write` replaces the entire task list on every call: send the complete list each time and mark items `pending` / `in_progress` / `completed`. Older Superpowers docs may refer to `TodoWrite`; treat that as the task-tracking action above. If `todo_write` is not visible, fall back to plan files or a repo-local `TODO.md`.

## Plan mode

DSH has its own plan mode: `/plan [message]` activates it and `exit_plan_mode` presents the complete plan for human review (the UI labels approval as "Approve"). Superpowers' `writing-plans` documents remain the authoritative artifact and flow unchanged.

## Shell / Windows

DSH runs shell commands through `bash` when the deployment provides it. On Windows hosts the harness may instead expose a PowerShell-backed shell tool — use whatever shell tool the session catalog lists. Do not invent tool names; always use the tools actually visible in the session.
