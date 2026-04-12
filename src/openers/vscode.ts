import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ClickTarget } from "../types.js";
import { commandExists } from "../utils/command.js";

export function buildVSCodeClickTarget(cwd: string | undefined): ClickTarget {
  if (!cwd) {
    return {
      type: "vscode",
      supported: "none",
      note: "No cwd was provided by the agent event."
    };
  }

  const absolute = resolve(cwd);
  const normalized = absolute.endsWith("/") ? absolute : `${absolute}/`;
  return {
    type: "vscode",
    cwd: absolute,
    uri: encodeURI(`vscode://file/${normalized}`),
    command: "code",
    args: ["--reuse-window", absolute],
    supported: "official-vscode-url"
  };
}

export function openVSCode(target: ClickTarget | undefined): boolean {
  if (!target?.cwd) return false;

  if (commandExists("code")) {
    const result = spawnSync("code", ["--reuse-window", target.cwd], {
      stdio: "ignore"
    });
    if (result.status === 0) return true;
  }

  if (process.platform === "darwin") {
    const appPath = "/Applications/Visual Studio Code.app";
    const args = existsSync(appPath)
      ? ["-a", "Visual Studio Code", target.cwd]
      : [target.uri ?? target.cwd];
    const result = spawnSync("open", args, { stdio: "ignore" });
    return result.status === 0;
  }

  if (process.platform === "linux" && target.uri && commandExists("xdg-open")) {
    const result = spawnSync("xdg-open", [target.uri], { stdio: "ignore" });
    return result.status === 0;
  }

  return false;
}
