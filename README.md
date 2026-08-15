# Pi Luna Workflow

A small, configurable [Pi](https://pi.dev) package for a three-stage engineering workflow:

1. A read-only `Luna-Max` preflight turns an ordinary request into a bounded engineering brief.
2. The primary Pi agent investigates, edits, verifies, and keeps final authority. After a non-trivial implementation and its direct check, it may run one read-only `luna_review` for the current request.
3. When a concrete high-risk decision remains, the primary agent may explicitly call `sol_consult` for a bounded, tool-free `Sol-Max` opinion.

This repository contains only the reusable workflow. It does not contain a provider adapter, API key, host integration, session data, telemetry, daemon, or deployment logic.

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

## Configure

The package does not discover or create model providers. Configure the models in Pi using the provider's normal settings, then set the workflow routes as `provider/model` values. The following names are placeholders:

```bash
export LUNA_WORKFLOW_LUNA_MODEL=your-provider/your-luna-model
export LUNA_WORKFLOW_PARENT_MODEL=your-provider/your-luna-model
export LUNA_WORKFLOW_SOL_MODEL=your-provider/your-sol-model
```

`LUNA_WORKFLOW_PARENT_MODEL` identifies the only parent route eligible for the workflow. If it is omitted, `LUNA_WORKFLOW_LUNA_MODEL` is used for the parent gate. The active parent session must select that model with thinking level `max`.

`LUNA_WORKFLOW_LUNA_MODEL` is used by the preflight and review children. `LUNA_WORKFLOW_SOL_MODEL` is used only by `sol_consult`. A missing route produces a visible configuration warning and keeps the unavailable child tool inactive; it never silently selects another model.

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

Start a session with the parent model and maximum thinking:

```bash
pi --model "$LUNA_WORKFLOW_PARENT_MODEL" --thinking max
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

### Sol consultation

`sol_consult` is active only for the same eligible parent gate and only when a Sol model is configured. It is an explicit model tool, not a background service or automatic escalation mechanism.

Each call requires:

- one precise question;
- one concrete risk class: `architecture`, `security`, `persistent-host`, `public-contract`, `failed-verification`, or `user-requested`;
- compact context and evidence;
- an optional bounded diff and verification result.

The Sol child runs with `--no-tools` and `--no-session`. It cannot inspect files, edit, deploy, or replace the primary agent's implementation or final decision.

## Commands And Gates

The extension registers:

- `/supervisor status` to report the session gate and configuration;
- `/supervisor on` and `/supervisor off` to change the session-local workflow switch;
- `luna_review`, active only under the configured parent model and `max` thinking;
- `sol_consult`, active only under the same gate and with a Sol route configured.

The workflow switch is stored as a Pi session entry so it follows the current session branch. It does not write a global setting.

A non-Luna-Max or non-`max` parent does not receive active `luna_review` or `sol_consult` tools. Changing the model or thinking level synchronizes that active-tool gate.

## Security And Privacy

Pi extensions run with the host permissions of the Pi process. Inspect this source before installation and treat the optional child extension paths as code execution.

The package itself:

- has no provider endpoint, hard-coded key path, API key, session file, host-specific absolute path, daemon, listener, timer, or telemetry;
- passes model names to child Pi processes but does not pass API keys on the command line;
- leaves provider authentication to Pi's configured provider runtime;
- starts preflight/review children with no session and no ambient extensions, skills, prompt templates, or context files;
- gives those children only `read`, `grep`, `find`, and `ls`, and adds a path guard for the selected working directory;
- gives Sol no tools at all;
- bounds child output and exposes child failures instead of silently treating them as success;
- leaves all edits, shell commands, deployment, remote actions, direct checks, and final decisions with the primary agent.

The configured model provider still receives the data needed for its role. Preflight receives the original request, recent bounded conversation text, working-directory identity, and repository observations. Review receives the task packet, actual diff, selected files, and reported checks. Sol receives only the compact packet supplied to `sol_consult`. Do not include secrets in those packets.

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

1. Set the three model variables and start a fresh parent session at `max`.
2. Submit ordinary text and confirm one read-only preflight brief with all eight headings, the original request marker, and no worktree change.
3. Submit a slash command, a steering message, and an image-bearing request and confirm automatic preflight is skipped.
4. Make a harmless tracked change, run the primary agent's direct check, then call `luna_review` once with the actual bounded diff. Confirm the reviewer reports the configured Luna route, only `read/grep/find/ls`, and no worktree mutation. A second call for the same request must be rejected.
5. Call `sol_consult` with one deliberately small risk-labelled packet. Confirm the configured Sol route, thinking `max`, an empty tool list, and no worktree mutation. Confirm no Sol call occurs without an explicit tool call.
6. Switch to another model or a non-`max` thinking level and confirm both child tools are removed from the active tool set.

The reviewer is an independent check, not a substitute for the primary agent's direct verification. Provider/model availability, model quality, and child latency remain environment-dependent.

## Known Limits

- The workflow is advisory and does not guarantee correct implementation or review.
- The parent agent must decide when a change is non-trivial, supply a bounded diff, resolve findings, and run final checks.
- Sol calls are explicit and risk-labelled; there is no automatic emergency classifier or call counter.
- The one-review budget is in-memory for the current Pi extension runtime and is reset for a new user request. The request boundary prevents an earlier conversation task from satisfying a later one.
- Child processes depend on the configured provider, model capabilities, Pi version, and network availability.
- The package does not install providers, manage credentials, create backups, deploy services, or alter the active Pi installation beyond Pi's normal package registration.
- A public repository is not a license grant. This release remains `UNLICENSED` until a separate licensing decision is made.
