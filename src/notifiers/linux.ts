import { spawnSync } from "node:child_process";
import { NormalizedEvent, NotifyResult } from "../types.js";
import { openVSCode } from "../openers/vscode.js";
import { commandExists, runDetached } from "../utils/command.js";

export function notifyLinux(event: NormalizedEvent): NotifyResult {
  if (!commandExists("notify-send")) {
    return {
      ok: false,
      method: "linux-notify-send",
      detail: "notify-send was not found."
    };
  }

  if (notifySendSupportsActions()) {
    const childEvent: NormalizedEvent = {
      provider: event.provider,
      eventType: event.eventType,
      sessionId: event.sessionId,
      threadId: event.threadId,
      cwd: event.cwd,
      projectName: event.projectName,
      title: event.title,
      body: event.body,
      clickTarget: event.clickTarget,
      iconTarget: event.iconTarget,
      raw: null
    };
    runDetached(process.execPath, [
      process.argv[1],
      "_linux-notify-child",
      JSON.stringify(childEvent)
    ]);
    return {
      ok: true,
      method: "linux-notify-send-action"
    };
  }

  const result = spawnSync("notify-send", baseNotifySendArgs(event), {
    encoding: "utf8",
    stdio: "pipe"
  });
  return {
    ok: result.status === 0,
    method: "linux-notify-send",
    detail: result.status === 0 ? undefined : result.stderr.trim() || result.stdout.trim()
  };
}

export function runLinuxNotifyChild(event: NormalizedEvent): number {
  const result = spawnSync(
    "notify-send",
    [
      ...baseNotifySendArgs(event),
      "--action=default=Open",
      "--wait",
      "--expire-time=900000"
    ],
    {
      encoding: "utf8",
      stdio: "pipe"
    }
  );

  if (result.status === 0 && result.stdout.trim()) {
    openVSCode(event.clickTarget);
  }

  return result.status ?? 1;
}

function baseNotifySendArgs(event: NormalizedEvent): string[] {
  const args = [
    `--app-name=${providerLabel(event)}`,
    "--category=development",
    "--hint=string:x-canonical-private-synchronous:smart-agent-notify",
    event.title ?? "Agent notification",
    event.body ?? ""
  ];

  if (event.iconTarget) args.unshift(`--icon=${event.iconTarget}`);
  return args;
}

function providerLabel(event: NormalizedEvent): string {
  return event.provider === "claude" ? "Claude Code" : "Codex";
}

function notifySendSupportsActions(): boolean {
  const result = spawnSync("notify-send", ["--help"], {
    encoding: "utf8",
    stdio: "pipe"
  });
  const help = `${result.stdout}\n${result.stderr}`;
  return result.status === 0 && help.includes("--action") && help.includes("--wait");
}
