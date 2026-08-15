#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url);
const rootPath = decodeURIComponent(root.pathname).replace(/\/$/, "");

const requiredFiles = [
  "package.json",
  "README.md",
  "README.zh-CN.md",
  "extensions/luna-workflow.ts",
  "extensions/child-readonly-guard.ts",
  "skills/luna-workflow/SKILL.md",
];

const requiredText = {
  "README.md": ["pi install", "luna_review", "sol_consult", "LUNA_WORKFLOW_LUNA_MODEL"],
  "README.zh-CN.md": ["pi install", "luna_review", "sol_consult", "LUNA_WORKFLOW_LUNA_MODEL"],
  "extensions/luna-workflow.ts": ["USER_INTENT", "luna_review", "sol_consult", "--no-session", "--no-tools"],
};

const forbiddenText = [
  ["/home", "ubuntu"].join("/") + "/",
  ["127", "0", "0", "1"].join(".") + ":18088",
  ["sub2api", "api", "key"].join("_"),
  ["auth", ".json"].join(""),
  ["PI_SESSION", "_FILE="].join(""),
];

const manifest = JSON.parse(await readFile(join(rootPath, "package.json"), "utf8"));
if (manifest.private === true) throw new Error("package.json must be publishable as a public source checkout");
if (manifest.license !== "UNLICENSED") throw new Error("license meaning must remain explicit as UNLICENSED");
if (!manifest.pi?.extensions?.includes("./extensions/luna-workflow.ts")) {
  throw new Error("Pi extension is missing from the manifest");
}

for (const relativePath of requiredFiles) {
  const path = join(rootPath, relativePath);
  const content = await readFile(path, "utf8");
  for (const needle of requiredText[relativePath] ?? []) {
    if (!content.includes(needle)) throw new Error(`${relativePath} is missing ${needle}`);
  }
  for (const needle of forbiddenText) {
    if (content.includes(needle)) throw new Error(`${relativePath} contains forbidden private text ${needle}`);
  }
}

console.log(`Package structure check passed (${requiredFiles.length} files).`);
