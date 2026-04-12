import { NormalizedEvent, NotifyResult } from "../types.js";
import { notifyLinux } from "./linux.js";
import { notifyMacOS } from "./macos.js";

export function notifyDesktop(event: NormalizedEvent): NotifyResult {
  if (process.platform === "darwin") return notifyMacOS(event);
  if (process.platform === "linux") return notifyLinux(event);
  return {
    ok: false,
    method: process.platform,
    detail: "This notifier currently supports macOS and Linux only."
  };
}
