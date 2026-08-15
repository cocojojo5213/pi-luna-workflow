import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { checkChildPath } from "./child-path-policy.mjs";

const ALLOWED_TOOLS = new Set(["read", "grep", "find", "ls"]);
const PATH_TOOLS = new Set(["read", "grep", "find", "ls"]);

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

    const reason = await checkChildPath(path, ctx.cwd);
    if (reason) {
      return {
        block: true,
        reason: `Read-only child access denied: ${reason}.`,
      };
    }
  });
}
