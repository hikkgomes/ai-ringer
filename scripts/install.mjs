#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = resolve(root, "dist/src/index.js");

execFileSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
execFileSync(process.execPath, [entry, "install", ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit"
});
