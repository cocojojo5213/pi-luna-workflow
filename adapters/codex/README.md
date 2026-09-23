# Codex adapter

The shared skill and agent profiles are installed from the repository root.
Model names and reasoning levels come from `workflow/roles.json`.

## Install or refresh

From a checkout of this repository, run:

```bash
npm run sync:codex
```

The command links `skills/luna-workflow` into `$CODEX_HOME/skills` (or
`~/.codex/skills`) and syncs `astra_consult.toml` and `luna_reviewer.toml`
under `$CODEX_HOME/agents`. It refuses to replace an existing skill. For an
existing read-only agent with the matching name, it updates only the model and
reasoning fields and preserves the rest of the file. Other conflicting files
are left untouched. Re-run it after updating the checkout to refresh model
settings.

Restart Codex or start a new session to load updated skills and agent profiles.
The selected primary model for an already-running session remains controlled
by the Codex client; repository updates do not switch an active session.

Launch a new session with the shared primary role using
`npm run start:codex -- [Codex arguments]`.

## Workflow behavior

The skill is discoverable for substantive engineering work. The primary Luna
agent implements and verifies. It calls `astra_consult` when material
uncertainty could change the design, scope, safety, or correctness, then calls
`luna_reviewer` once after direct checks for a non-trivial change. Both profiles
are generated from the shared role map and run read-only.
