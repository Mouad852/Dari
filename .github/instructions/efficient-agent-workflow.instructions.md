---
description: Apply the user's preferred low-credit workflow for Dari coding sessions.
---

# Efficient agent workflow

- Prefer one focused feature per session and avoid unrelated backlog work.
- When the target files are known, name them in the task and inspect only the files needed for that feature.
- Treat existing verification results as trusted context unless the changed area makes them stale; do not repeat broad audits.
- Start with the smallest targeted validation command that proves the changed behavior, then run the documented build/typecheck only when relevant.
- Batch independent file reads and checks; avoid serial exploration when the next files are already predictable.
- Preserve known project constraints and out-of-scope items from the handoff instead of rediscovering them.
- Before stopping, update the relevant `README.md`, `plans/README.md`, and specific phase plan documents when the project status or documented scope changed.
- End with a concise summary of changed files, rationale, commands run, failures, and anything not browser-verified.
- Always provide a ready-to-paste prompt for the next session describing the next focused task, relevant files/docs, acceptance criteria, validation commands, known failures, and explicit out-of-scope items.

Example:

> Implement listing submit preconditions in `apps/api/.../ListingSearchService.java` and its tests.
> Require a description and at least one photo; preserve the existing lifecycle rules.
> Run the focused API test, then `cd apps/api && ./mvnw test` if the focused test passes.
