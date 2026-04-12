import test from "node:test";
import assert from "node:assert/strict";
import { enrichEvent } from "../src/smart-summary.js";
import { normalizeClaudeEvent } from "../src/providers/claude.js";
import { normalizeCodexEvent } from "../src/providers/codex.js";

test("Claude permission request becomes an approval notification", () => {
  const event = enrichEvent(
    normalizeClaudeEvent({
      session_id: "s1",
      cwd: "/tmp/payments-api",
      hook_event_name: "PermissionRequest",
      tool_name: "Bash",
      tool_input: { command: "npm test" }
    })!
  );

  assert.equal(event.eventType, "approval_required");
  assert.equal(event.projectName, "payments-api");
  assert.match(event.title ?? "", /Waiting for approval: run npm test/);
  assert.equal(event.clickTarget?.supported, "official-vscode-url");
});

test("Claude stop event uses assistant message for context", () => {
  const event = enrichEvent(
    normalizeClaudeEvent({
      session_id: "s2",
      cwd: "/tmp/auth-service",
      hook_event_name: "Stop",
      stop_hook_active: false,
      last_assistant_message: "Refactored token refresh and added regression tests."
    })!
  );

  assert.equal(event.eventType, "completed");
  assert.match(event.title ?? "", /Refactored token refresh/);
  assert.match(event.title ?? "", /auth-service/);
});

test("Claude active stop hook continuation is suppressed", () => {
  const event = normalizeClaudeEvent({
    session_id: "s3",
    cwd: "/tmp/auth-service",
    hook_event_name: "Stop",
    stop_hook_active: true
  });

  assert.equal(event, undefined);
});

test("Codex notify payload becomes a completed event", () => {
  const event = enrichEvent(
    normalizeCodexEvent({
      type: "agent-turn-complete",
      "turn-id": "t1",
      cwd: "/tmp/webhooks",
      "last-assistant-message": "Fixed retry behavior in the webhook handler."
    })!
  );

  assert.equal(event.provider, "codex");
  assert.equal(event.eventType, "completed");
  assert.equal(event.threadId, "t1");
  assert.match(event.title ?? "", /Fixed retry behavior/);
});
