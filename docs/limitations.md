# Supported Capabilities And Limitations

This document records the support matrix used by the implementation. It is based on the official docs checked on 2026-04-13.

## Claude Code

Supported and installed by default:

- Completion: `Stop` runs when the main Claude Code agent finishes responding. `SubagentStop` and `TaskCompleted` are also supported and installed because they provide useful completion context for subagents and Claude agent teams.
- Failure: `StopFailure` runs when a turn ends due to an API error.
- Permission prompts: `PermissionRequest` runs when a permission dialog is about to be shown and includes `tool_name` and `tool_input`.
- User input: `Elicitation` runs when an MCP server requests user input mid-task. `Notification` with `idle_prompt` is also installed for idle/user-action reminders.
- Context fields: Claude hook payloads include `session_id`, `transcript_path`, `cwd`, and `hook_event_name`; several completion hooks include `last_assistant_message`.

Not implemented:

- Opening an exact Claude Code session in VS Code. I did not find an official Claude Code VS Code deep link or command that opens a specific session from an external notification.
- Parsing Claude transcript files for richer summaries. The hook payload already contains useful fields for supported events, and transcript parsing would couple the tool to storage details beyond what is needed.

Sources:

- Claude Code hooks reference: https://docs.anthropic.com/en/docs/claude-code/hooks
- Claude Code settings reference: https://docs.anthropic.com/en/docs/claude-code/settings
- Claude Code IDE integrations: https://docs.anthropic.com/en/docs/claude-code/ide-integrations

## Codex

Supported and installed by default:

- Completion: Codex has an official `notify` command setting in `~/.codex/config.toml`; Codex runs it when the agent finishes a turn.
- Project context: the tool uses `cwd` when Codex provides it. If a legacy notify payload omits `cwd`, the process working directory is used as the best available fallback.

Supported by Codex docs but not installed by default:

- Lifecycle hooks: Codex documents hooks such as `Stop`, `PreToolUse`, `PostToolUse`, and `UserPromptSubmit`, and their common fields include `session_id`, `transcript_path`, `cwd`, and `hook_event_name`. The same docs and config reference mark `features.codex_hooks` as under development/off by default, so this tool does not enable them automatically.

Not implemented:

- Smart Codex input-needed notifications. I found Codex `tui.notifications` for built-in terminal notifications and approval settings, but no documented external `notify` event for approval-requested or input-needed. The installer therefore does not invent one.
- Opening an exact Codex thread/session in VS Code. Codex IDE docs list command IDs such as `chatgpt.openSidebar` and `chatgpt.newCodexPanel`, but I found no official URI or external command that opens a specific thread by id.

Sources:

- Codex config reference: https://developers.openai.com/codex/config-reference
- Codex hooks reference: https://developers.openai.com/codex/hooks
- Codex config docs in the official repository: https://github.com/openai/codex/blob/main/docs/config.md
- Codex IDE commands: https://developers.openai.com/codex/ide/commands

## Click Handling

Supported:

- VS Code officially supports `vscode://file/{full path to project}/` URLs. Notifications use this project URL when the notifier can attach a click action. The fallback opener uses `code --reuse-window <cwd>` when the `code` command is available.

macOS:

- macOS has app-level notification APIs, but there is no built-in Apple CLI that can create a clickable notification which opens an arbitrary VS Code URL and avoids Script Editor. This tool uses `terminal-notifier` on macOS because it supports `-open URL` for notification clicks and `-group` for replacing duplicate notifications.
- Without `terminal-notifier`, the macOS adapter logs a warning and does not use AppleScript. This intentionally avoids notifications that may open Script Editor or Scripts.app.

Linux:

- Linux uses `notify-send`. If the installed version supports `--action` and `--wait`, the tool starts a detached child process that waits for the click and opens VS Code. If actions are not supported by the notification server, it sends a normal notification without click handling.
- The freedesktop.org notification spec allows actions and icons, but it explicitly says clients should not assume all servers generate action signals.

Sources:

- VS Code URL handling: https://code.visualstudio.com/docs/editor/command-line#_opening-vs-code-with-urls
- terminal-notifier options: https://github.com/julienXX/terminal-notifier
- freedesktop.org notification protocol: https://specifications.freedesktop.org/notification/latest/protocol.html
- freedesktop.org icons and images: https://specifications.freedesktop.org/notification/latest/icons-and-images.html
- notify-send man page: https://manpages.ubuntu.com/manpages/noble/man1/notify-send.1.html

## Icons

Supported:

- Linux can pass icon names or paths to `notify-send`.
- macOS click support uses `terminal-notifier`; its documented `-appIcon` flag relies on a private method, so this tool does not enable it by default.

Fallback:

- The repo includes generic fallback SVGs in `assets/`, but they are not official Claude/OpenAI logos.
- Official logo rendering is intentionally not promised because the reliable click path and reliable custom icon path differ by OS and notification daemon.

## Windows

Windows support is not implemented. Codex hooks are documented as disabled on Windows, and this first version targets the macOS and Linux notification mechanisms that can be audited locally.
