#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const rolesConfig = JSON.parse(await readFile(join(repoRoot, "workflow", "roles.json"), "utf8"));
const primary = rolesConfig.roles?.primary;
if (!primary?.model || primary.reasoning !== "max") {
  throw new Error("workflow/roles.json must define a primary model at max reasoning");
}

const target = process.argv[2];
if (target !== "pi" && target !== "codex") {
  throw new Error("Usage: node scripts/launch.mjs <pi|codex> [client arguments...]");
}

const clientArgs = process.argv.slice(3);
let model = primary.model;
const args = ["--model", model];

if (target === "pi") {
  const provider = process.env.LUNA_WORKFLOW_PI_PROVIDER?.trim();
  const parentRoute = process.env.LUNA_WORKFLOW_PARENT_MODEL?.trim();
  if (parentRoute) model = parentRoute;
  else if (provider) model = `${provider}/${primary.model}`;
  else {
    throw new Error("Set LUNA_WORKFLOW_PI_PROVIDER or LUNA_WORKFLOW_PARENT_MODEL before starting Pi");
  }
  args[1] = model;
  args.push("--thinking", primary.reasoning, ...clientArgs);
} else {
  args.push("--config", `model_reasoning_effort=${primary.reasoning}`, ...clientArgs);
}

const child = spawn(target, args, { stdio: "inherit", env: process.env });
child.on("error", (error) => {
  process.stderr.write(`Could not start ${target}: ${error.message}\n`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
