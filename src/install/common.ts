import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { shellQuote } from "../utils/command.js";

export const MANAGED_START = "# >>> smart-agent-notify";
export const MANAGED_END = "# <<< smart-agent-notify";

export function timestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
}

export function backupIfExists(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  const backupPath = `${path}.bak.${timestamp()}`;
  copyFileSync(path, backupPath);
  return backupPath;
}

export function ensureParent(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

export function cliEntryPath(): string {
  return resolve(fileURLToPath(new URL("../index.js", import.meta.url)));
}

export function commandForProvider(provider: "claude" | "codex"): string {
  return `${shellQuote(process.execPath)} ${shellQuote(cliEntryPath())} notify --provider ${provider}`;
}

export function argvForProvider(provider: "claude" | "codex"): string[] {
  return [process.execPath, cliEntryPath(), "notify", "--provider", provider];
}

export function createLocalShim(): string {
  const shimPath = localShimPath();
  const binDir = dirname(shimPath);
  mkdirSync(binDir, { recursive: true });
  const shim = `#!/bin/sh
exec ${shellQuote(process.execPath)} ${shellQuote(cliEntryPath())} "$@"
`;
  writeFileSync(shimPath, shim, { encoding: "utf8", mode: 0o755 });
  return shimPath;
}

export function localShimPath(): string {
  return join(homedir(), ".local", "bin", "smart-agent-notify");
}
