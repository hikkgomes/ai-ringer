# smart-agent-notify

Smart local desktop notifications for Claude Code and Codex.

This repo builds one small CLI, `smart-agent-notify`, with provider-specific payload normalizers, a shared event schema, smart notification summaries, OS-specific notification adapters, and idempotent installers for Claude Code and Codex.

## Research Summary

Verified on 2026-04-13 against current official docs:

- Claude Code has documented hooks for `Stop`, `StopFailure`, `PermissionRequest`, `Notification`, `SubagentStop`, `TaskCompleted`, and `Elicitation`. Hook payloads include `session_id`, `transcript_path`, `cwd`, and `hook_event_name`; completion/input hooks expose useful fields like `last_assistant_message`, `tool_name`, `tool_input`, and `message`.
- Codex has an official `notify` config command. This tool sends desktop notifications only for Codex completion/failure payloads and ignores start/unknown lifecycle payloads. Codex also documents lifecycle hooks, but `features.codex_hooks` is under development/off by default, so the installer does not enable Codex hooks automatically.
- Codex does not currently document an external `notify` event for approval-requested or input-needed. The strongest supported Codex path here is smart completion notifications through `notify`.
- I found no official Claude Code or Codex URI that opens a specific session/thread in VS Code. The supported fallback is opening the project/workspace via VS Code's official `vscode://file/{full path to project}/` URL or `code --reuse-window <cwd>`.
- macOS clickable notifications from a CLI require a helper. This tool uses `terminal-notifier` because it supports opening a URL on notification click and avoids AppleScript/Script Editor. Linux uses `notify-send`, with action-click support only where the installed notification server and `notify-send` support it.

See [docs/limitations.md](docs/limitations.md) for the full support matrix and source links.

## Architecture

- [src/providers/claude.ts](src/providers/claude.ts): maps official Claude Code hook payloads to the internal event schema.
- [src/providers/codex.ts](src/providers/codex.ts): maps Codex `notify` payloads and optional experimental hook-shaped payloads to the same schema.
- [src/smart-summary.ts](src/smart-summary.ts): converts raw event context into short titles and readable bodies.
- [src/notifiers/macos.ts](src/notifiers/macos.ts): sends clickable macOS notifications through `terminal-notifier`.
- [src/notifiers/linux.ts](src/notifiers/linux.ts): sends Linux desktop notifications through `notify-send`.
- [src/openers/vscode.ts](src/openers/vscode.ts): builds and opens the documented VS Code project URL fallback.
- [src/install/claude.ts](src/install/claude.ts): safely patches `~/.claude/settings.json`.
- [src/install/codex.ts](src/install/codex.ts): safely patches `~/.codex/config.toml`.

## Install

Prerequisites:

- Node.js 20.10 or newer.
- macOS: `terminal-notifier` for clickable notifications.
- Linux: `notify-send` from libnotify.

macOS:

```sh
brew install terminal-notifier
npm install
npm run setup
```

Linux:

```sh
npm install
npm run setup
```

The installer:

- builds the TypeScript source,
- creates `~/.local/bin/smart-agent-notify`,
- backs up and patches `~/.claude/settings.json`,
- backs up and patches `~/.codex/config.toml`.

Every config change is idempotent. Existing config files are copied to `*.bak.<timestamp>` before writes.

For a clean reinstall during updates, including replacing old Claude hooks on the managed events and replacing an existing top-level Codex `notify = ...` command, run:

```sh
npm run setup:force
```

Equivalent:

```sh
npm run setup -- --force
```

Force mode still writes timestamped backups before changing `~/.claude/settings.json` or `~/.codex/config.toml`.

## Uninstall

```sh
npm run uninstall
```

Remove the generated `~/.local/bin/smart-agent-notify` wrapper too:

```sh
npm run uninstall -- --remove-shim
```

Backups are not deleted.

## Claude Code Setup

Run:

```sh
npm run setup
```

The installer adds command hooks for:

- `Stop`
- `StopFailure`
- `SubagentStop`
- `TaskCompleted`
- `PermissionRequest`
- `Elicitation`
- `Notification` with matcher `idle_prompt|auth_success`

`PermissionRequest` is used for permission prompts instead of the broader `Notification` `permission_prompt` matcher because it contains structured `tool_name` and `tool_input` data. That makes messages like `Waiting for approval: run npm test` possible.

## Codex Setup

Run:

```sh
npm run setup
```

The installer adds this managed block to `~/.codex/config.toml` when no existing `notify = ...` command is present:

```toml
# >>> smart-agent-notify
# Official Codex notify command. smart-agent-notify ignores non-completion lifecycle events.
notify = ["/path/to/node", "/path/to/repo/dist/src/index.js", "notify", "--provider", "codex"]
# <<< smart-agent-notify
```

If you already have a Codex `notify` command, the installer leaves it untouched and prints a warning. Chain manually by calling `smart-agent-notify notify --provider codex "$payload"` from your existing notify script.
To replace the existing command instead, run `npm run setup:force`.

Codex input-needed notifications are not installed because Codex does not currently document an external input-needed/approval-requested notify event. Built-in TUI notifications are separate from this tool and are configured with Codex's `tui.notifications`.

## Test Fixtures

Preview normalized smart notifications without sending desktop notifications:

```sh
npm test
node dist/src/index.js fixture --provider claude fixtures/claude-stop.json
node dist/src/index.js fixture --provider claude fixtures/claude-permission-request.json
node dist/src/index.js fixture --provider claude fixtures/claude-elicitation.json
node dist/src/index.js fixture --provider codex fixtures/codex-agent-turn-complete.json
```

Send a real notification from a fixture:

```sh
node dist/src/index.js notify --provider claude --payload @fixtures/claude-stop.json
```

Use `--dry-run` to print the final event:

```sh
node dist/src/index.js notify --provider codex --dry-run --payload @fixtures/codex-agent-turn-complete.json
```

## Smart Summary Rules

The summary builder uses, in order:

- last assistant message,
- task subject or description,
- approval tool input such as a Bash command,
- elicitation message,
- project name derived from `cwd`.

Titles are kept short and contextual. Repeated identical events are deduped for 10 seconds in `~/.smart-agent-notify/state.json`.
Every generated title starts with `Claude:` or `Codex:` because macOS and Linux notification shells often show the notifier app identity rather than the agent identity.

## Click Behavior

Fully supported:

- Open the project in VS Code using `vscode://file/{cwd}/` when the notifier supports URL click actions.
- Fall back to `code --reuse-window <cwd>` when opening directly from the CLI.

Best effort:

- Exact Claude/Codex session or thread opening is not implemented because I found no official external deep link for either tool.
- Linux click behavior depends on the notification server supporting actions.

Intentionally not used:

- AppleScript notifications. They do not provide the click behavior needed here and risk landing in Script Editor/Scripts.app rather than VS Code.

## Icons

Linux passes a theme icon name to `notify-send`. The repo includes generic fallback SVG assets, but it does not promise true Claude/OpenAI logo rendering.

macOS uses the notifier app icon by default. `terminal-notifier -appIcon` is documented as relying on a private method, so this tool disables it unless you explicitly set:

```sh
SMART_AGENT_NOTIFY_EXPERIMENTAL_APP_ICON=1
```

## Troubleshooting

`terminal-notifier is required`

Install it:

```sh
brew install terminal-notifier
```

`code command not found`

In VS Code, run `Shell Command: Install 'code' command in PATH` from the Command Palette. Click handling can still use `vscode://file/...` URLs when the OS has the VS Code URL handler installed.

No Codex notifications

Check `~/.codex/config.toml`. If another `notify = ...` command already exists, the installer did not overwrite it. Chain this tool from your existing notify script.

No Claude notifications

Check `~/.claude/settings.json` for the managed hook commands. Also verify Claude Code can run `node` at the absolute path recorded in the hook command.

Linux click does nothing

Your notification server may not support actions. `notify-send --help` should list `--action` and `--wait`; even then, the freedesktop spec permits servers to ignore action signals.

## Sources

- Claude Code hooks: https://docs.anthropic.com/en/docs/claude-code/hooks
- Claude Code settings: https://docs.anthropic.com/en/docs/claude-code/settings
- Codex config reference: https://developers.openai.com/codex/config-reference
- Codex hooks: https://developers.openai.com/codex/hooks
- Codex config docs: https://github.com/openai/codex/blob/main/docs/config.md
- Codex IDE commands: https://developers.openai.com/codex/ide/commands
- VS Code URL handling: https://code.visualstudio.com/docs/editor/command-line#_opening-vs-code-with-urls
- terminal-notifier: https://github.com/julienXX/terminal-notifier
- freedesktop notifications: https://specifications.freedesktop.org/notification/latest/protocol.html
- notify-send: https://manpages.ubuntu.com/manpages/noble/man1/notify-send.1.html
