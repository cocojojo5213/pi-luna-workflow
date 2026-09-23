#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkChildPath, resolveChildWorkingDirectory } from "../extensions/child-path-policy.mjs";

const root = new URL("..", import.meta.url);
const rootPath = decodeURIComponent(root.pathname).replace(/\/$/, "");

const requiredFiles = [
  "package.json",
  "README.md",
  "README.zh-CN.md",
  "extensions/luna-workflow.ts",
  "extensions/child-readonly-guard.ts",
  "extensions/child-path-policy.mjs",
  "skills/luna-workflow/SKILL.md",
  "skills/luna-workflow/references/workflow-contract.md",
  "workflow/roles.json",
  "adapters/codex/README.md",
  "scripts/launch.mjs",
  "scripts/sync-codex.mjs",
];

const requiredText = {
  "README.md": ["pi install", "luna_review", "advisor_consult", "workflow/roles.json", "sync:codex", "start:codex"],
  "README.zh-CN.md": ["pi install", "luna_review", "advisor_consult", "workflow/roles.json", "sync:codex", "start:codex"],
  "extensions/luna-workflow.ts": ["USER_INTENT", "luna_review", "advisor_consult", "LUNA_WORKFLOW_ADVISOR_THINKING", "--no-session", "--no-tools"],
  "skills/luna-workflow/references/workflow-contract.md": ["Primary", "Advisor", "Reviewer"],
  "scripts/launch.mjs": ["Usage: node scripts/launch.mjs", "max reasoning", "LUNA_WORKFLOW_PI_PROVIDER"],
  "scripts/sync-codex.mjs": ["astra_consult.toml", "luna_reviewer.toml", "leaving it untouched"],
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

const rolesConfig = JSON.parse(await readFile(join(rootPath, "workflow/roles.json"), "utf8"));
const { primary, reviewer, advisor } = rolesConfig.roles ?? {};
if (!primary?.model || !reviewer?.model || !advisor?.model) {
  throw new Error("workflow/roles.json must configure primary, reviewer, and advisor models");
}
if (primary.model !== reviewer.model || primary.reasoning !== "max" || reviewer.reasoning !== "max") {
  throw new Error("primary and reviewer must share the same model at max reasoning");
}
if (advisor.reasoning !== "low") {
  throw new Error("the advisor role must use low reasoning");
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

const tempRoot = await mkdtemp(join(tmpdir(), "pi-luna-workflow-"));
const outsideRoot = await mkdtemp(join(tmpdir(), "pi-luna-workflow-outside-"));
try {
  await mkdir(join(tempRoot, ".ssh"));
  await writeFile(join(outsideRoot, "visible.txt"), "outside\n");
  await symlink(outsideRoot, join(tempRoot, "link"), "dir");

  assert.ok(await checkChildPath("../outside", tempRoot), "out-of-root path must be rejected");
  assert.ok(await checkChildPath(".ssh/id_rsa", tempRoot), "SSH private key path must be rejected");
  assert.ok(await checkChildPath("link/visible.txt", tempRoot), "symlink escape must be rejected");

  let protectedRootRejected = false;
  try {
    await resolveChildWorkingDirectory(tempRoot, ".ssh");
  } catch {
    protectedRootRejected = true;
  }
  assert.equal(protectedRootRejected, true, "protected child roots must be rejected");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await rm(outsideRoot, { recursive: true, force: true });
}

console.log(`Package structure and child-path checks passed (${requiredFiles.length} files).`);
