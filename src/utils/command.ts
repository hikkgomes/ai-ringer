import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { dirname } from "node:path";

export function commandExists(command: string): boolean {
  const result = spawnSync("which", [command], { encoding: "utf8" });
  return result.status === 0 && Boolean(result.stdout.trim());
}

export function executablePath(command: string): string | undefined {
  const result = spawnSync("which", [command], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function runDetached(command: string, args: string[]): void {
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore"
  });
  child.unref();
}

export function canExecute(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function parentDirectory(path: string): string {
  return dirname(path);
}
