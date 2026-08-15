---
name: luna-workflow
description: Use the installed Pi Luna workflow for read-only preflight, one bounded implementation review, and explicit high-risk Sol consultation. Use when the user is working in a configured Luna-Max Pi session or asks about this workflow.
license: UNLICENSED
compatibility: Requires Pi 0.84 or newer and a user-configured provider/model route for each enabled role.
---

# Luna Workflow

The package extension owns the runtime behavior. This skill is only the operating contract:

- Ordinary natural-language requests in an eligible `Luna-Max` session receive one advisory, read-only preflight before the primary agent acts.
- The original user request is authoritative. The primary agent must re-check repository facts, make edits, run direct checks, and make the final judgment.
- After a non-trivial implementation and its direct check, call `luna_review` at most once for the current user request. Give it the actual bounded diff, acceptance criteria, relevant files, and exact verification results.
- Treat review output as findings, not as verification. Resolve concrete findings and run the direct check again when a correction is needed.
- Call `sol_consult` only for one explicit, materially justified architecture, security, persistent-host, public-contract, failed-verification, or user-requested question. Send a compact packet; Sol has no tools and does not edit or verify the work.
- Do not use a review from an earlier request to satisfy the current request. Do not add automatic Sol escalation or background delegation.

Use `/supervisor status` to inspect the session gate. Model routes and child-process settings are configured outside this skill as described in the package README.
