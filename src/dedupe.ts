import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { asRecord } from "./utils/objects.js";

interface DedupeState {
  seen: Record<string, number>;
}

const DEFAULT_WINDOW_MS = 10_000;

export function shouldSkipDedupe(key: string | undefined, windowMs = DEFAULT_WINDOW_MS): boolean {
  if (!key) return false;
  const now = Date.now();
  const state = readState();
  prune(state, now, Math.max(windowMs * 12, 60_000));

  const lastSeen = state.seen[key];
  if (lastSeen && now - lastSeen < windowMs) {
    writeState(state);
    return true;
  }

  state.seen[key] = now;
  writeState(state);
  return false;
}

function statePath(): string {
  return join(homedir(), ".smart-agent-notify", "state.json");
}

function readState(): DedupeState {
  try {
    const parsed = JSON.parse(readFileSync(statePath(), "utf8")) as unknown;
    const record = asRecord(parsed);
    const seenRecord = asRecord(record.seen);
    const seen: Record<string, number> = {};
    for (const [key, value] of Object.entries(seenRecord)) {
      if (typeof value === "number") seen[key] = value;
    }
    return { seen };
  } catch {
    return { seen: {} };
  }
}

function writeState(state: DedupeState): void {
  const path = statePath();
  mkdirSync(join(homedir(), ".smart-agent-notify"), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function prune(state: DedupeState, now: number, maxAgeMs: number): void {
  for (const [key, lastSeen] of Object.entries(state.seen)) {
    if (now - lastSeen > maxAgeMs) delete state.seen[key];
  }
}
