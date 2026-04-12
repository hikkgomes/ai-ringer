import { NormalizedEvent } from "../types.js";
import { asRecord, projectNameFromCwd, stringValue } from "../utils/objects.js";

export function normalizeCodexEvent(input: unknown): NormalizedEvent | undefined {
  const raw = asRecord(input);
  const type =
    stringValue(raw.type) ??
    stringValue(raw.event) ??
    stringValue(raw.hook_event_name) ??
    "agent-turn-complete";
  const cwd =
    stringValue(raw.cwd) ??
    stringValue(raw.working_dir) ??
    stringValue(raw.workdir) ??
    process.cwd();

  const base = {
    provider: "codex" as const,
    sessionId:
      stringValue(raw.session_id) ??
      stringValue(raw["session-id"]) ??
      stringValue(raw.conversation_id),
    threadId:
      stringValue(raw.thread_id) ??
      stringValue(raw["thread-id"]) ??
      stringValue(raw.turn_id) ??
      stringValue(raw["turn-id"]),
    cwd,
    projectName: projectNameFromCwd(cwd),
    raw: input
  };

  if (type === "agent-turn-complete" || type === "Stop") {
    return {
      ...base,
      eventType: "completed",
      rawSummarySource: lastAssistantText(raw)
    };
  }

  if (type === "StopFailure") {
    return {
      ...base,
      eventType: "failure",
      rawSummarySource:
        stringValue(raw.error) ??
        stringValue(raw.reason) ??
        stringValue(raw.last_assistant_message)
    };
  }

  return {
    ...base,
    eventType: "info",
    rawSummarySource: stringValue(raw.message) ?? type
  };
}

function lastAssistantText(raw: Record<string, unknown>): string | undefined {
  return (
    stringValue(raw.last_assistant_message) ??
    stringValue(raw["last-assistant-message"]) ??
    stringValue(raw.lastAssistantMessage) ??
    stringValue(raw.message) ??
    stringValue(raw.summary)
  );
}
