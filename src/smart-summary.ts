import { createHash } from "node:crypto";
import { NormalizedEvent } from "./types.js";
import { buildVSCodeClickTarget } from "./openers/vscode.js";
import { truncate } from "./utils/objects.js";

const PROVIDER_LABELS = {
  claude: "Claude",
  codex: "Codex"
} as const;

export function enrichEvent(rawEvent: NormalizedEvent): NormalizedEvent {
  const event = { ...rawEvent };
  event.clickTarget ??= buildVSCodeClickTarget(event.cwd);
  event.iconTarget ??= defaultIcon(event.provider);

  const summary = bestSummary(event);
  const titleSummary = summary ? stripTrailingPunctuation(summary) : undefined;
  const project = event.projectName ?? "project";
  const provider = PROVIDER_LABELS[event.provider];

  if (!event.title || !event.body) {
    switch (event.eventType) {
      case "completed":
        event.title ??= titleSummary
          ? completedTitle(titleSummary, project)
          : truncate(`${provider} finished work in ${project}`, 72);
        event.body ??= bodyFor(event, summary || "Open the project to review the final response.");
        break;
      case "approval_required":
        event.title ??= truncate(`Waiting for approval: ${summary || provider}`, 72);
        event.body ??= bodyFor(event, "Review the requested action and approve or deny it in the agent.");
        break;
      case "input_required":
        event.title ??= truncate(`Need your input: ${summary || project}`, 72);
        event.body ??= bodyFor(event, "Respond in the agent session to continue.");
        break;
      case "failure":
        event.title ??= truncate(`${provider} hit a problem in ${project}`, 72);
        event.body ??= bodyFor(event, summary || "Open the project to inspect the failure.");
        break;
      case "info":
        event.title ??= truncate(`${provider}: ${summary || "notification"}`, 72);
        event.body ??= bodyFor(event, "Open the project in VS Code.");
        break;
    }
  }

  event.title = truncate(event.title ?? `${provider} notification`, 72);
  event.body = truncate(event.body ?? "", 180);
  event.dedupeKey = dedupeKey(event);
  return event;
}

function bodyFor(event: NormalizedEvent, message: string): string {
  const parts = [message];
  if (event.cwd) parts.push(event.cwd);
  return parts.join(" - ");
}

function bestSummary(event: NormalizedEvent): string | undefined {
  const source = cleanupText(event.rawSummarySource ?? "");
  if (!source) return undefined;

  const actionable = source
    .split(/(?<=[.!?])\s+|\n+/)
    .map(cleanupText)
    .find((sentence) => {
      const lower = sentence.toLowerCase();
      return /^(added|built|changed|created|fixed|implemented|updated|refactored|removed|completed|waiting|need|needs|request|approve|choose|select|provide|failed|error|blocked)\b/.test(
        lower
      );
    });

  return truncate(actionable ?? source, 78);
}

function cleanupText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, "code block")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[#*_>\-[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.!?]+$/g, "").trim();
}

function completedTitle(summary: string, project: string): string {
  const suffix = ` in ${project}`;
  const available = Math.max(24, 72 - suffix.length);
  return `${truncate(sentenceCase(summary), available)}${suffix}`;
}

function defaultIcon(provider: NormalizedEvent["provider"]): string {
  return provider === "claude" ? "utilities-terminal" : "applications-development";
}

function dedupeKey(event: NormalizedEvent): string {
  const basis = [
    event.provider,
    event.eventType,
    event.sessionId ?? "",
    event.threadId ?? "",
    event.cwd ?? "",
    event.title ?? "",
    event.body ?? ""
  ].join("\n");
  return createHash("sha256").update(basis).digest("hex");
}
