# Shared workflow contract

This document defines the platform-neutral Luna workflow. [`workflow/roles.json`](../../../workflow/roles.json)
is the single source for default model IDs and reasoning levels; adapters may
accept local provider routes as overrides.

## Roles

- **Primary:** `primary` model at its configured reasoning level. It owns the
  task, repository investigation, edits, direct checks, and final judgment.
- **Advisor:** `advisor` model at its configured reasoning level. Ask for advice
  when a material uncertainty could change the design, scope, safety, or
  correctness of the work. Send one precise question with the relevant facts,
  constraints, options, and evidence. The advisor advises; it does not own
  implementation or verification.
- **Reviewer:** `reviewer` model at its configured reasoning level. After a
  non-trivial implementation and its direct checks, request one independent
  review with the actual bounded diff, acceptance criteria, and exact check
  results. Investigate concrete findings and keep final verification with the
  primary.

Skip consultation for routine choices that the primary can settle from local
evidence. Skip review for ordinary answers, read-only work, and tiny obvious
edits. A review from an earlier request never covers a later request.

## Adapter boundary

Adapters translate these roles and gates into their host's model routing,
delegation, and installation mechanisms. They may add host-specific behavior
such as Pi's read-only preflight, but should not change the shared ownership
rules above. Missing or unavailable routes must be reported; adapters must not
silently select a different model or reasoning level.
