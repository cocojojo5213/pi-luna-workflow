import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const ALLOWED_TOOLS = new Set(["read", "grep", "find", "ls"]);
const PATH_TOOLS = new Set(["read", "grep", "find", "ls"]);
const SENSITIVE_SEGMENT = /^(?:\.pi|\.git|\.env(?:\..*)?|auth(?:\..*)?|credentials?(?:\..*)?|secrets?(?:\..*)?|.*(?:api[-_]?key|private[-_]?key|password|cookie).*)$/iu;

function isInside(root: string, candidate: string): boolean {
  const child = relative(root, candidate);
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}

function relativeSegments(root: string, candidate: string): string[] {
  return relative(root, candidate).split(/[\\/]+/u).filter(Boolean);
}

function hasSensitiveSegment(root: string, candidate: string): boolean {
  return relativeSegments(root, candidate).some((segment) => SENSITIVE_SEGMENT.test(segment));
}

async function checkPath(rawPath: string, cwd: string): Promise<string | undefined> {
  const path = rawPath.startsWith("@") ? rawPath.slice(1) : rawPath;
  if (!path || path === "-") return undefined;

  const root = resolve(cwd);
  const candidate = resolve(root, path);
  if (!isInside(root, candidate) || hasSensitiveSegment(root, candidate)) {
    return "path is outside the child working directory or targets a protected path";
  }

  let realRoot: string;
  try {
    realRoot = await realpath(root);
  } catch {
    return "child working directory cannot be resolved";
  }

  let realCandidate = candidate;
  try {
    realCandidate = await realpath(candidate);
  } catch {
    // The built-in tool will report a missing path. Keep the lexical boundary check.
  }

  if (!isInside(realRoot, realCandidate) || hasSensitiveSegment(realRoot, realCandidate)) {
    return "path resolves outside the child working directory or targets a protected path";
  }
  return undefined;
}

export default function childReadonlyGuard(pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (!ALLOWED_TOOLS.has(event.toolName)) {
      return {
        block: true,
        reason: "This isolated child permits only read, grep, find, and ls.",
      };
    }

    if (!PATH_TOOLS.has(event.toolName)) return;
    const input = event.input;
    if (!input || typeof input !== "object") return;
    const path = (input as { path?: unknown }).path;
    if (typeof path !== "string") return;

    const reason = await checkPath(path, ctx.cwd);
    if (reason) {
      return {
        block: true,
        reason: `Read-only child access denied: ${reason}.`,
      };
    }
  });
}
