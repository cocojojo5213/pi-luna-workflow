---
name: luna-workflow
description: "Use the shared Luna engineering workflow in Pi or Codex: Luna-Max owns implementation, Astra-low advises on material uncertainty, and Luna-Max reviews non-trivial changes after direct checks."
license: UNLICENSED
---

# Luna Workflow

Follow the shared role definitions in [the workflow contract](references/workflow-contract.md).
`workflow/roles.json` is the source for default model IDs and reasoning levels.
Use this workflow for substantive engineering work; do not add delegation to
ordinary answers, read-only checks, or tiny obvious edits.

The primary agent remains responsible for repository investigation, edits,
direct checks, resolving review findings, and the final answer. The user's
request remains authoritative.

Consult the configured advisor when an unresolved material uncertainty could
change the result. Prepare one focused question and include only the relevant
facts, constraints, options, evidence, and bounded diff or check results. Do
not consult for routine reassurance.

After a non-trivial implementation and direct checks, use the configured
read-only reviewer once for the current request. Supply the actual bounded
diff, observable acceptance criteria, and exact check outcomes. Treat findings
as evidence to investigate, not as verification. If a fix changes reviewed
behavior, run direct checks again and request a focused review only when
needed.

## Host tools

- **Codex:** Use `astra_consult` for the advisor role and `luna_reviewer` for
  independent review. The repository's Codex sync script installs this skill
  and generates those agent profiles from `workflow/roles.json`.
- **Pi:** Use `advisor_consult` for material uncertainty and `luna_review` after
  a non-trivial implementation and direct checks. Pi may also run its own
  read-only preflight. `sol_consult` remains available only as a legacy route
  when configured.

If a role is unavailable or its configured model does not match the requested
role, report that limitation instead of silently substituting another model.
