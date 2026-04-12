import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { InstallResult } from "../types.js";
import { argvForProvider, backupIfExists, ensureParent, MANAGED_END, MANAGED_START } from "./common.js";

export function installCodex(): InstallResult {
  const path = codexConfigPath();
  const original = existsSync(path) ? readFileSync(path, "utf8") : "";
  const withoutManaged = removeManagedBlock(original);

  if (/^\s*notify\s*=/m.test(withoutManaged)) {
    return {
      changed: false,
      path,
      message:
        "Codex config already has a notify command. Leaving it untouched; see README for manual chaining."
    };
  }

  const block = codexManagedBlock();
  const next = `${withoutManaged.trimEnd()}${withoutManaged.trim() ? "\n\n" : ""}${block}\n`;
  if (next === original) {
    return { changed: false, path, message: "Codex notify already configured." };
  }

  ensureParent(path);
  backupIfExists(path);
  writeFileSync(path, next, "utf8");
  return { changed: true, path, message: "Codex notify command configured." };
}

export function uninstallCodex(): InstallResult {
  const path = codexConfigPath();
  if (!existsSync(path)) {
    return { changed: false, path, message: "Codex config file does not exist." };
  }

  const original = readFileSync(path, "utf8");
  const next = removeManagedBlock(original);
  if (next === original) {
    return { changed: false, path, message: "No managed Codex block found." };
  }

  backupIfExists(path);
  writeFileSync(path, next.trimEnd() ? `${next.trimEnd()}\n` : "", "utf8");
  return { changed: true, path, message: "Managed Codex notify block removed." };
}

export function codexConfigPath(): string {
  return join(homedir(), ".codex", "config.toml");
}

function codexManagedBlock(): string {
  const command = argvForProvider("codex")
    .map((part) => JSON.stringify(part))
    .join(", ");
  return `${MANAGED_START}
# Official Codex notify command. Codex invokes this only for agent-turn-complete.
notify = [${command}]
${MANAGED_END}`;
}

function removeManagedBlock(input: string): string {
  const pattern = new RegExp(
    `${escapeRegExp(MANAGED_START)}[\\s\\S]*?${escapeRegExp(MANAGED_END)}\\n?`,
    "g"
  );
  return input.replace(pattern, "").trimEnd();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
