export type Provider = "claude" | "codex";

export type EventType =
  | "completed"
  | "approval_required"
  | "input_required"
  | "failure"
  | "info";

export interface ClickTarget {
  type: "vscode";
  cwd?: string;
  uri?: string;
  command?: string;
  args?: string[];
  supported: "official-vscode-url" | "code-cli-fallback" | "none";
  note?: string;
}

export interface NormalizedEvent {
  provider: Provider;
  eventType: EventType;
  sessionId?: string;
  threadId?: string;
  cwd?: string;
  projectName?: string;
  title?: string;
  body?: string;
  rawSummarySource?: string;
  clickTarget?: ClickTarget;
  iconTarget?: string;
  dedupeKey?: string;
  raw: unknown;
}

export interface NotifyResult {
  ok: boolean;
  method: string;
  detail?: string;
}

export interface InstallResult {
  changed: boolean;
  path: string;
  message: string;
}
