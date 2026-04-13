import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { NormalizedEvent, NotifyResult } from "../types.js";
import { commandExists } from "../utils/command.js";

export function notifyMacOS(event: NormalizedEvent): NotifyResult {
  if (!commandExists("terminal-notifier")) {
    return {
      ok: false,
      method: "macos-terminal-notifier",
      detail:
        "terminal-notifier is required for reliable clickable macOS notifications from this CLI."
    };
  }

  const args = [
    "-title",
    event.title ?? "Agent notification",
    "-message",
    event.body ?? "",
    "-group",
    `smart-agent-notify.${event.provider}.${event.sessionId ?? event.threadId ?? event.eventType}`
  ];

  args.push("-subtitle", event.projectName ? `${providerLabel(event)} - ${event.projectName}` : providerLabel(event));
  if (event.clickTarget?.uri) args.push("-open", event.clickTarget.uri);
  if (process.env.SMART_AGENT_NOTIFY_SOUND !== "off") args.push("-sound", "default");

  if (
    process.env.SMART_AGENT_NOTIFY_EXPERIMENTAL_APP_ICON === "1" &&
    event.iconTarget &&
    existsSync(event.iconTarget)
  ) {
    args.push("-appIcon", event.iconTarget);
  }

  const result = spawnSync("terminal-notifier", args, {
    encoding: "utf8",
    stdio: "pipe"
  });

  return {
    ok: result.status === 0,
    method: "macos-terminal-notifier",
    detail: result.status === 0 ? undefined : result.stderr.trim() || result.stdout.trim()
  };
}

function providerLabel(event: NormalizedEvent): string {
  return event.provider === "claude" ? "Claude" : "Codex";
}
