import { unlinkSync } from "node:fs";
import { createLocalShim, localShimPath } from "./common.js";
import { installClaude, uninstallClaude } from "./claude.js";
import { installCodex, uninstallCodex } from "./codex.js";

export function installAll(): string[] {
  const messages: string[] = [];
  const shim = createLocalShim();
  messages.push(`Installed local wrapper: ${shim}`);

  for (const result of [installClaude(), installCodex()]) {
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
  return "macOS click support requires terminal-notifier. Install it with: brew install terminal-notifier";
}
