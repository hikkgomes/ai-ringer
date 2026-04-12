#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { stdin as input } from "node:process";
import { shouldSkipDedupe } from "./dedupe.js";
import { installAll, uninstallAll } from "./install/index.js";
import { notifyDesktop } from "./notifiers/index.js";
import { runLinuxNotifyChild } from "./notifiers/linux.js";
import { openVSCode } from "./openers/vscode.js";
import { normalizeClaudeEvent } from "./providers/claude.js";
import { normalizeCodexEvent } from "./providers/codex.js";
import { enrichEvent } from "./smart-summary.js";
import { NormalizedEvent, Provider } from "./types.js";

async function main(): Promise<number> {
  const [command = "help", ...args] = process.argv.slice(2);

  try {
    switch (command) {
      case "notify":
        return await handleNotify(args);
      case "fixture":
        return handleFixture(args);
      case "install":
        for (const message of installAll()) console.log(message);
        return 0;
      case "uninstall":
        for (const message of uninstallAll(args.includes("--remove-shim"))) console.log(message);
        return 0;
      case "open":
        return handleOpen(args);
      case "_linux-notify-child":
        return runLinuxNotifyChild(enrichEvent(JSON.parse(args[0] ?? "{}") as NormalizedEvent));
      case "help":
      case "--help":
      case "-h":
        printHelp();
        return 0;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        return 2;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function handleNotify(args: string[]): Promise<number> {
  const options = parseOptions(args);
  const payloadText = options.payload ?? (await readStdin());
  const payload = parsePayload(payloadText);
  const normalized = normalize(options.provider, payload);
  if (!normalized) return 0;

  const event = enrichEvent(normalized);
  if (options.dryRun) {
    console.log(JSON.stringify(event, null, 2));
    return 0;
  }

  if (shouldSkipDedupe(event.dedupeKey)) return 0;
  const result = notifyDesktop(event);
  if (!result.ok && result.detail) {
    console.error(`[smart-agent-notify] ${result.method}: ${result.detail}`);
  }
  return 0;
}

function handleFixture(args: string[]): number {
  const options = parseOptions(args);
  const file = options.payload ?? args.find((arg) => !arg.startsWith("-"));
  if (!file) throw new Error("Missing fixture file path.");
  const payload = JSON.parse(readFileSync(file, "utf8")) as unknown;
  const normalized = normalize(options.provider, payload);
  if (!normalized) return 0;
  const event = enrichEvent(normalized);
  console.log(JSON.stringify(event, null, 2));
  return 0;
}

function handleOpen(args: string[]): number {
  const cwd = args[0];
  const event = enrichEvent({
    provider: "codex",
    eventType: "info",
    cwd,
    raw: {}
  });
  return openVSCode(event.clickTarget) ? 0 : 1;
}

function normalize(provider: Provider, payload: unknown): NormalizedEvent | undefined {
  return provider === "claude" ? normalizeClaudeEvent(payload) : normalizeCodexEvent(payload);
}

function parseOptions(args: string[]): { provider: Provider; dryRun: boolean; payload?: string } {
  let provider: Provider | undefined;
  let dryRun = false;
  let payload: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--provider") {
      const value = args[index + 1];
      if (value !== "claude" && value !== "codex") {
        throw new Error("--provider must be claude or codex.");
      }
      provider = value;
      index += 1;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--payload") {
      payload = args[index + 1];
      index += 1;
    } else if (!arg.startsWith("-") && payload === undefined) {
      payload = arg;
    }
  }

  return { provider: provider ?? "codex", dryRun, payload };
}

function parsePayload(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("@")) {
    return JSON.parse(readFileSync(trimmed.slice(1), "utf8")) as unknown;
  }
  return JSON.parse(trimmed) as unknown;
}

async function readStdin(): Promise<string> {
  if (input.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of input) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function printHelp(): void {
  console.log(`smart-agent-notify

Usage:
  smart-agent-notify notify --provider claude < payload.json
  smart-agent-notify notify --provider codex '{"type":"agent-turn-complete"}'
  smart-agent-notify fixture --provider claude fixtures/claude-stop.json
  smart-agent-notify install
  smart-agent-notify uninstall [--remove-shim]
`);
}

main().then((code) => {
  process.exitCode = code;
});
