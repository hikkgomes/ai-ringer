import { unlinkSync } from "node:fs";
import { createLocalShim, localShimPath } from "./common.js";
import { installClaude, uninstallClaude } from "./claude.js";
import { installCodex, uninstallCodex } from "./codex.js";
import { commandExists } from "../utils/command.js";

export function installAll(options: { force?: boolean } = {}): string[] {
  const messages: string[] = [];
  const shim = createLocalShim();
  messages.push(`Installed local wrapper: ${shim}`);
  if (options.force) messages.push("Force mode: replacing managed Claude events and top-level Codex notify.");

  for (const result of [installClaude(options), installCodex(options)]) {
    messages.push(`${result.changed ? "Updated" : "Unchanged"} ${result.path}: ${result.message}`);
  }

  messages.push(macOSDependencyHint());
  return messages.filter(Boolean);
}

export function uninstallAll(removeShim: boolean): string[] {
  const messages: string[] = [];
  for (const result of [uninstallClaude(), uninstallCodex()]) {
    messages.push(`${result.changed ? "Updated" : "Unchanged"} ${result.path}: ${result.message}`);
  }

  if (removeShim) {
    try {
      const shim = localShimPath();
      unlinkSync(shim);
      messages.push(`Removed local wrapper: ${shim}`);
    } catch {
      messages.push("No local wrapper removed.");
    }
  }

  return messages;
}

function macOSDependencyHint(): string {
  if (process.platform !== "darwin") return "";
  return commandExists("terminal-notifier")
    ? "macOS click support: terminal-notifier found."
    : "macOS click support requires terminal-notifier. Install it with: brew install terminal-notifier";
}
