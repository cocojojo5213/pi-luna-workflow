import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

const PROTECTED_SEGMENT = /^(?:\.pi|\.git|\.ssh|\.env(?:\..*)?|auth(?:\..*)?|credentials?(?:\..*)?|secrets?(?:\..*)?|tokens?(?:[._-].*)?|id_(?:rsa|dsa|ecdsa|ed25519)(?:[._-].*)?|known_hosts(?:[._-].*)?|.*(?:api[-_]?key|private[-_]?key|password|cookie).*)$/iu;
const PROTECTED_EXTENSION = /\.(?:pem|key|p12|pfx)$/iu;

export function isInsideRoot(root, candidate) {
  const child = relative(root, candidate);
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}

export function hasProtectedPath(candidate) {
  return candidate
    .split(/[\\/]+/u)
    .filter(Boolean)
    .some((segment) => PROTECTED_SEGMENT.test(segment) || PROTECTED_EXTENSION.test(segment));
}

function pathFromTool(rawPath) {
  return rawPath.startsWith("@") ? rawPath.slice(1) : rawPath;
}

export async function checkChildPath(rawPath, cwd) {
  const path = pathFromTool(rawPath);
  if (!path || path === "-") return undefined;

  const root = resolve(cwd);
  const candidate = resolve(root, path);
  if (!isInsideRoot(root, candidate)) {
    return "path is outside the child working directory";
  }
  if (hasProtectedPath(root) || hasProtectedPath(candidate)) {
    return "path targets a protected credential or Pi metadata location";
  }

  let realRoot;
  try {
    realRoot = await realpath(root);
  } catch {
    return "child working directory cannot be resolved";
  }
  if (hasProtectedPath(realRoot)) {
    return "child working directory resolves to a protected location";
  }

  let realCandidate = candidate;
  try {
    realCandidate = await realpath(candidate);
  } catch {
    // The built-in tool will report a missing path. Keep lexical checks for it.
  }

  if (!isInsideRoot(realRoot, realCandidate)) {
    return "path resolves outside the child working directory";
  }
  if (hasProtectedPath(realCandidate)) {
    return "path resolves to a protected credential or Pi metadata location";
  }
  return undefined;
}

export async function resolveChildWorkingDirectory(parentCwd, requestedCwd) {
  let parentRoot;
  let childRoot;
  try {
    parentRoot = await realpath(resolve(parentCwd));
    childRoot = await realpath(resolve(parentCwd, requestedCwd));
  } catch {
    throw new Error("child working directory does not exist or cannot be resolved");
  }

  if (!isInsideRoot(parentRoot, childRoot)) {
    throw new Error("child working directory must remain inside the parent working directory");
  }
  if (hasProtectedPath(parentRoot) || hasProtectedPath(childRoot)) {
    throw new Error("child working directory resolves to a protected credential or Pi metadata location");
  }
  return childRoot;
}
