import { NormalizedEvent } from "../types.js";
import { asRecord, boolValue, projectNameFromCwd, stringValue } from "../utils/objects.js";

export function normalizeClaudeEvent(input: unknown): NormalizedEvent | undefined {
  const raw = asRecord(input);
  const hookEvent = stringValue(raw.hook_event_name) ?? "Notification";
  const cwd = stringValue(raw.cwd);
  const sessionId = stringValue(raw.session_id);
  const base = {
    provider: "claude" as const,
    sessionId,
    cwd,
    projectName: projectNameFromCwd(cwd),
    raw: input
  };

  switch (hookEvent) {
    case "Stop":
      if (boolValue(raw.stop_hook_active)) return undefined;
      return {
        ...base,
        eventType: "completed",
        rawSummarySource: lastAssistantText(raw) ?? transcriptHint(raw)
      };
    case "SubagentStop":
    case "TaskCompleted":
      return {
        ...base,
        eventType: "completed",
        rawSummarySource:
          stringValue(raw.task_subject) ??
          stringValue(raw.task_description) ??
          stringValue(raw.result) ??
          stringValue(raw.summary) ??
          lastAssistantText(raw) ??
          transcriptHint(raw)
      };
    case "StopFailure":
      return {
        ...base,
        eventType: "failure",
        rawSummarySource:
          stringValue(raw.reason) ??
          stringValue(raw.error) ??
          stringValue(raw.message) ??
          transcriptHint(raw)
      };
    case "PermissionRequest":
      return {
        ...base,
        eventType: "approval_required",
        rawSummarySource: permissionSummary(raw)
      };
    case "Elicitation":
      return {
        ...base,
        eventType: "input_required",
        rawSummarySource:
          stringValue(raw.prompt) ??
          stringValue(raw.message) ??
          stringValue(raw.question) ??
          "additional input"
      };
    case "Notification":
      return normalizeClaudeNotification(input, raw, base);
    default:
      return {
        ...base,
        eventType: "info",
        rawSummarySource:
          stringValue(raw.message) ??
          stringValue(raw.notification_type) ??
          `Claude hook ${hookEvent}`
      };
  }
}

function normalizeClaudeNotification(
  input: unknown,
  raw: Record<string, unknown>,
  base: Omit<NormalizedEvent, "eventType" | "rawSummarySource">
): NormalizedEvent {
  const notificationType = stringValue(raw.notification_type) ?? "";
  const message = stringValue(raw.message) ?? stringValue(raw.title);
  const type =
    notificationType === "permission_prompt"
      ? "approval_required"
      : notificationType === "idle_prompt" || notificationType === "elicitation_dialog"
        ? "input_required"
        : notificationType === "auth_success"
          ? "info"
          : "info";

  return {
    ...base,
    raw: input,
    eventType: type,
    rawSummarySource: message ?? notificationType
  };
}

function permissionSummary(raw: Record<string, unknown>): string | undefined {
  const toolName = stringValue(raw.tool_name);
  const reason = stringValue(raw.reason) ?? stringValue(raw.message);
  const toolInput = asRecord(raw.tool_input);

  const command = stringValue(toolInput.command);
  if (command) return `run ${command}`;

  const filePath =
    stringValue(toolInput.file_path) ??
    stringValue(toolInput.path) ??
    stringValue(toolInput.notebook_path);
  if (toolName && filePath) return `${toolName} ${filePath}`;
  if (toolName) return toolName;
  return reason;
}

function lastAssistantText(raw: Record<string, unknown>): string | undefined {
  return (
    stringValue(raw.last_assistant_message) ??
    stringValue(raw.assistant_message) ??
    stringValue(raw.response) ??
    stringValue(raw.message)
  );
}

function transcriptHint(raw: Record<string, unknown>): string | undefined {
  const transcriptPath = stringValue(raw.transcript_path);
  return transcriptPath ? `transcript available at ${transcriptPath}` : undefined;
}
