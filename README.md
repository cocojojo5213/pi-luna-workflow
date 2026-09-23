# Luna Workflow

A shared engineering workflow for Pi and Codex, with model roles and reasoning levels maintained in [`workflow/roles.json`](workflow/roles.json):

- `gpt-6-luna` at `max` is the primary and reviewer model.
- `gpt-6-astra` at `low` is the advisor for material uncertainty.
- The primary owns implementation, direct checks, and final judgment. A separate Luna reviewer checks non-trivial changes after direct checks.

The shared contract lives in [`skills/luna-workflow/references/workflow-contract.md`](skills/luna-workflow/references/workflow-contract.md). The Pi extension remains the Pi adapter and keeps its read-only preflight. The Codex adapter links the shared skill and generates its reviewer/advisor profiles from the role map.

> **License notice:** This repository is public but intentionally declares `UNLICENSED`. Public visibility does not grant permission to reuse, redistribute, or publish modified copies. Choose and add a license separately if that policy changes.

## Install

Review the extension source before installing it. Pi packages execute with the permissions of the Pi process.

```bash
pi install git:github.com/cocojojo5213/pi-luna-workflow
```

Restart Pi or run `/reload` in an existing session. To remove it:

```bash
pi remove git:github.com/cocojojo5213/pi-luna-workflow
```

For a project-local installation, add `-l` to the install and remove commands.

## Configure model roles

Edit `workflow/roles.json` when the model lineup changes. Codex profiles use those IDs directly. Pi needs the configured provider name; set it once and the extension combines it with the shared model IDs. These provider names are placeholders:

```bash
export LUNA_WORKFLOW_PI_PROVIDER=your-provider
```

Optional per-role overrides use `provider/model` routes:

```bash
export LUNA_WORKFLOW_PARENT_MODEL=your-provider/gpt-6-luna
export LUNA_WORKFLOW_LUNA_MODEL=your-provider/gpt-6-luna
export LUNA_WORKFLOW_ADVISOR_MODEL=your-provider/gpt-6-astra
export LUNA_WORKFLOW_ADVISOR_THINKING=low
```

`LUNA_WORKFLOW_PARENT_MODEL` identifies the primary route eligible for the workflow. If omitted, the explicit Luna route is used; otherwise the `primary` role from `workflow/roles.json` is combined with `LUNA_WORKFLOW_PI_PROVIDER`. The active primary session must select that model at `max`.

`LUNA_WORKFLOW_LUNA_MODEL` overrides the shared `reviewer` route and is used by Pi preflight and review children. `LUNA_WORKFLOW_ADVISOR_MODEL` and `LUNA_WORKFLOW_ADVISOR_THINKING` override the shared `advisor` role. The old `LUNA_WORKFLOW_SOL_MODEL` remains available through the legacy `sol_consult` tool. Missing routes produce visible configuration warnings and keep unavailable tools inactive; adapters never silently select another model.

## Install or refresh Codex

From a checkout of this repository, run:

```bash
npm run sync:codex
```

This links the shared skill into `$CODEX_HOME/skills` (default `~/.codex/skills`) and syncs the `astra_consult` and `luna_reviewer` profiles under `$CODEX_HOME/agents`. Existing compatible read-only agent profiles keep their instructions; only their model and reasoning fields are updated. Conflicting files are left untouched. After pulling repository updates, run it again to refresh model settings. Start a new Codex session to load changes; changing repository defaults does not switch an active session's primary model.

Start new Codex sessions through the shared primary role:

```bash
npm run start:codex -- [Codex arguments]
```

The launcher selects the configured primary model at `max`, so new launched sessions follow model updates in `workflow/roles.json`.

Optional process settings:

```bash
export LUNA_WORKFLOW_PI_COMMAND=pi
export LUNA_WORKFLOW_CHILD_TIMEOUT_MS=720000
```

`LUNA_WORKFLOW_PI_COMMAND` can point to a trusted Pi wrapper or executable. `LUNA_WORKFLOW_CHILD_TIMEOUT_MS` accepts 1000 through 3600000 milliseconds and defaults to 720000.

The default child guard is bundled with this package. Advanced users may replace it with a compatible trusted extension:

```bash
export LUNA_WORKFLOW_CHILD_GUARD_PATH=/absolute/path/to/readonly-guard.ts
```

If a provider is registered by an extension rather than by Pi's normal model configuration, trusted provider extensions can be supplied to isolated children. Separate paths with the platform path delimiter:

```bash
export LUNA_WORKFLOW_CHILD_EXTENSION_PATHS=/absolute/path/to/provider-extension.ts
```

These extra extensions are not part of this project and are executed in the child process. Do not point this setting at an unreviewed extension.

Start a Pi session with the primary model and maximum thinking:

```bash
npm run start:pi -- [Pi arguments]
```

The package intentionally does not edit Pi settings or credentials for you.

## Workflow

### Preflight

For an ordinary natural-language request in an eligible parent session, the extension starts one no-session child with:

- the configured Luna model at `max` thinking;
- `read`, `grep`, `find`, and `ls` only;
- no session, project context files, skills, prompt templates, or ambient extensions;
- the bundled read-only guard, which rejects writes, non-read-only tools, paths outside the child working directory, and direct paths to common credential/configuration locations;
- bounded output and the configured timeout.

The child receives the current working directory, a bounded recent user/assistant text context, and the unchanged original request. It must return these eight top-level Markdown sections:

- `USER_INTENT`
- `IN_SCOPE`
- `OUT_OF_SCOPE`
- `ACCEPTANCE_CRITERIA`
- `REPOSITORY_FOCUS`
- `IMPLEMENTATION_GUIDANCE`
- `VERIFICATION`
- `RISKS_AND_OPEN_QUESTIONS`

The brief is advisory. The original request remains authoritative, and the primary agent must re-check repository facts before editing. A failed or timed-out preflight is inserted as an actionable failure message so the primary agent continues from the original request instead of stopping silently.

Preflight is skipped for extension commands, slash commands, steering messages, empty input, and image-bearing requests. This extension does not implement automatic emergency detection.

### Review

`luna_review` is active only when the parent is the configured model at `max` thinking. The primary agent should call it only after a non-trivial local or shared-workflow implementation and its direct check.

The tool requires:

- the original task;
- observable acceptance criteria;
- a bounded actual diff, not a summary in place of the diff;
- exact checks already run;
- only the relevant surrounding files.

The review child runs once for the current user request, with a fresh no-session read-only Pi process and no ability to run commands or edit. The primary agent must resolve concrete findings and retain final verification and judgment. A review from an earlier request in the same conversation does not count.

### Astra advisor

`advisor_consult` is active for the eligible Luna-Max parent and configured advisor route. By default it uses the `advisor` role from `workflow/roles.json`: Astra at `low`. Call it when unresolved uncertainty could materially change design, scope, safety, or correctness. It is explicit, read-only advice, not automatic escalation.

Each call requires:

- one precise question;
- one reason: `uncertainty`, `architecture`, `security`, `persistent-host`, `public-contract`, `failed-verification`, or `user-requested`;
- compact context and evidence;
- an optional bounded diff and verification result.

The advisor child uses its configured reasoning level and runs with `--no-tools` and `--no-session`. It cannot inspect files, edit, deploy, or replace the primary agent's implementation or final decision. `sol_consult` remains available as a legacy `max` route when `LUNA_WORKFLOW_SOL_MODEL` is set.

## Commands And Gates

The extension registers:

- `/supervisor status` to report the session gate and configuration;
- `/supervisor on` and `/supervisor off` to change the session-local workflow switch;
- `luna_review`, active only under the configured parent model and `max` thinking;
- `advisor_consult`, active only under the same gate and with an advisor route configured;
- legacy `sol_consult`, active only when its legacy route is configured.

The workflow switch is stored as a Pi session entry so it follows the current session branch. It does not write a global setting.

A parent that does not match the configured Luna model at `max` does not receive active review or consultation tools. Changing the model or thinking level synchronizes that active-tool gate.

## Security And Privacy

Pi extensions run with the host permissions of the Pi process. Inspect this source before installation and treat the optional child extension paths as code execution.

The package itself:

- has no provider endpoint, hard-coded key path, API key, session file, host-specific absolute path, daemon, listener, timer, or telemetry;
- passes model names to child Pi processes but does not pass API keys on the command line;
- leaves provider authentication to Pi's configured provider runtime;
- starts preflight/review children with no session and no ambient extensions, skills, prompt templates, or context files;
- gives those children only `read`, `grep`, `find`, and `ls`, and adds a path guard for the selected working directory;
- gives the advisor and legacy Sol consultation children no tools at all;
- bounds child output and exposes child failures instead of silently treating them as success;
- leaves all edits, shell commands, deployment, remote actions, direct checks, and final decisions with the primary agent.

The configured model provider still receives the data needed for its role. Preflight receives the original request, recent bounded conversation text, working-directory identity, and repository observations. Review receives the task packet, actual diff, selected files, and reported checks. The advisor receives only the compact packet supplied to `advisor_consult` or the legacy `sol_consult`. Do not include secrets in those packets.

The guard is a practical Pi-level boundary, not a kernel sandbox. A provider extension supplied through `LUNA_WORKFLOW_CHILD_EXTENSION_PATHS` is outside this repository's trust boundary. Use a container or OS sandbox when a stronger isolation guarantee is required.

## Verification

From a clean checkout:

```bash
node scripts/verify-package.mjs
```

The check validates the manifest, required resources, bilingual documentation markers, and absence of known private host/configuration strings.

To load the extension without credentials or network model discovery, use a temporary Pi profile:

```bash
agent_dir="$(mktemp -d)"
trap 'rm -rf "$agent_dir"' EXIT
PI_CODING_AGENT_DIR="$agent_dir" PI_OFFLINE=1 \
  pi --no-session --no-extensions --no-context-files \
  --extension ./extensions/luna-workflow.ts --list-models
```

An empty or unrelated model catalog is acceptable in this no-credential check. A configured parent without a usable child model must report the configuration/model error and must not start a child with a fallback route.

For the live key-flow smoke, use a disposable checkout and a provider already configured in Pi:

1. Set the Pi provider route and start a fresh Luna parent session at `max`; confirm `/supervisor status` shows Astra at `low`.
2. Submit ordinary text and confirm one read-only preflight brief with all eight headings, the original request marker, and no worktree change.
3. Submit a slash command, a steering message, and an image-bearing request and confirm automatic preflight is skipped.
4. Make a harmless tracked change, run the primary agent's direct check, then call `luna_review` once with the actual bounded diff. Confirm the reviewer reports the configured Luna route, only `read/grep/find/ls`, and no worktree mutation. A second call for the same request must be rejected.
5. Call `advisor_consult` with one small uncertainty packet. Confirm the configured Astra route, thinking `low`, an empty tool list, and no worktree mutation. Confirm it is not called without an explicit tool call.
6. If the legacy Sol route is configured, confirm `sol_consult` remains available at `max`.
7. Switch to another parent model or a non-`max` thinking level; confirm review and advisor tools leave the active tool set.

The reviewer is an independent check, not a substitute for the primary agent's direct verification. Provider/model availability, model quality, and child latency remain environment-dependent.

## Known Limits

- The workflow is advisory and does not guarantee correct implementation or review.
- The parent agent must decide when a change is non-trivial, supply a bounded diff, resolve findings, and run final checks.
- Advisor calls are explicit and evidence-bound; there is no automatic emergency classifier or call counter.
- The one-review budget is in-memory for the current Pi extension runtime and is reset for a new user request. The request boundary prevents an earlier conversation task from satisfying a later one.
- Child processes depend on the configured provider, model capabilities, Pi version, and network availability.
- The package does not install providers, manage credentials, create backups, deploy services, or alter the active Pi installation beyond Pi's normal package registration.
- A public repository is not a license grant. This release remains `UNLICENSED` until a separate licensing decision is made.
