import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { InstallResult } from "../types.js";
import { asRecord } from "../utils/objects.js";
import { backupIfExists, commandForProvider, ensureParent } from "./common.js";

type ClaudeHook = {
  type?: string;
  command?: string;
  timeout?: number;
};

type ClaudeHookGroup = {
  matcher?: string;
  hooks?: ClaudeHook[];
};

const CLAUDE_EVENTS: Array<{ event: string; matcher?: string }> = [
  { event: "Stop" },
  { event: "StopFailure" },
  { event: "SubagentStop" },
  { event: "TaskCompleted" },
  { event: "PermissionRequest" },
  { event: "Elicitation" },
  { event: "Notification", matcher: "idle_prompt|auth_success" }
];

export function installClaude(): InstallResult {
  const path = claudeSettingsPath();
  const settings = readClaudeSettings(path);
  const command = commandForProvider("claude");
  const hooks = asRecord(settings.hooks) as Record<string, ClaudeHookGroup[]>;
  let changed = false;

  for (const entry of CLAUDE_EVENTS) {
    const groups = Array.isArray(hooks[entry.event]) ? hooks[entry.event] : [];
    if (!hasManagedCommand(groups, command, entry.matcher)) {
      groups.push({
        ...(entry.matcher ? { matcher: entry.matcher } : {}),
        hooks: [{ type: "command", command, timeout: 5 }]
      });
      hooks[entry.event] = groups;
      changed = true;
    }
  }

  if (!changed) {
    return { changed: false, path, message: "Claude Code hooks already configured." };
  }

  settings.hooks = hooks;
  ensureParent(path);
  backupIfExists(path);
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return { changed: true, path, message: "Claude Code hooks configured." };
}

export function uninstallClaude(): InstallResult {
  const path = claudeSettingsPath();
  if (!existsSync(path)) {
    return { changed: false, path, message: "Claude Code settings file does not exist." };
  }

  const settings = readClaudeSettings(path);
  const hooks = asRecord(settings.hooks) as Record<string, ClaudeHookGroup[]>;
  let changed = false;

  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    const filteredGroups = groups
      .map((group) => ({
        ...group,
        hooks: (group.hooks ?? []).filter((hook) => !isSmartAgentCommand(hook.command))
      }))
      .filter((group) => (group.hooks ?? []).length > 0);

    if (filteredGroups.length !== groups.length || changedHookCount(groups) !== changedHookCount(filteredGroups)) {
      changed = true;
      if (filteredGroups.length) hooks[event] = filteredGroups;
      else delete hooks[event];
    }
  }

  if (!changed) {
    return { changed: false, path, message: "No managed Claude Code hooks found." };
  }

  settings.hooks = hooks;
  backupIfExists(path);
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return { changed: true, path, message: "Managed Claude Code hooks removed." };
}

export function claudeSettingsPath(): string {
  return join(homedir(), ".claude", "settings.json");
}

function readClaudeSettings(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function hasManagedCommand(groups: ClaudeHookGroup[], command: string, matcher: string | undefined): boolean {
  return groups.some((group) => {
    if ((group.matcher ?? undefined) !== matcher) return false;
    return (group.hooks ?? []).some((hook) => hook.command === command);
  });
}

function isSmartAgentCommand(command: string | undefined): boolean {
  return Boolean(command?.includes("smart-agent-notify") || command?.includes(" notify --provider claude"));
}

function changedHookCount(groups: ClaudeHookGroup[]): number {
  return groups.reduce((count, group) => count + (group.hooks ?? []).length, 0);
}
