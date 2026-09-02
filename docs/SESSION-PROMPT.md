# Session prompt

Paste this at the start of a new Claude Code session. Change the phase number on
the last line; everything else stays the same.

Keep the working-mode section verbatim — Claude Code edits files by default, and
this project is being built by hand on purpose.

---

```
I'm building Dari, a colocation platform for Morocco. The repo is scaffolded and
planned; I'm now implementing it phase by phase.

## How I want to work — important

**Do not edit, create or delete any files.** I write all the code myself. Your
job is to give me the code and tell me where it goes, and I'll apply it.

For each step:
- tell me the exact file path
- give me the complete contents of that file, or a clearly marked snippet with
  enough surrounding context that I know where it slots in
- explain what it does and why it's built that way, briefly
- tell me how to verify it worked before we move on

You may read files, search, and run read-only commands (mvn compile, tests,
builds, docker, curl, psql) to check the state of things or verify my work.
Anything that writes to a file, I do.

Work in small steps. One coherent unit at a time — a migration, an entity, an
endpoint. Stop after each and wait for me to say it's applied. Don't dump a whole
phase at once. If I paste an error, help me fix it before continuing.

## Read these first, in this order

1. `README.md` — layout and how to run it
2. `ARCHITECTURE.md` — how the system fits together and why; §8 says what is real
   versus scaffolding
3. `docs/NAMING.md` — French vs English. Non-negotiable, and it has a glossary
   and a false-friends list. Check it before naming anything
4. `docs/colocation-platform-design.md` — the authoritative design doc: data
   model, API surface (§7), lifecycle (§4), moderation (§6)
5. `plans/README.md` then the plan and guide for the phase we're on

Skim the design system in `design-system/readme.md` when we touch UI. It is the
visual source of truth and is treated as a vendored dependency — never edit it.

## Where the project stands

- Maven Spring Boot API in `apps/api`, Next.js App Router web app in `apps/web`.
  Both compile and build clean.
- Built for real: Firebase token auth chain, the error envelope, cursor
  pagination primitives, UUIDv7, the `users` feature end to end, Testcontainers
  harness on real PostGIS.
- Scaffolded only: 38 endpoints across 7 controllers throw
  `NotImplementedYetException` and return 501; 17 web routes render
  `<Placeholder>`. Each one names the phase that fills it in.
- No entities or repositories exist for unbuilt features. That's deliberate — an
  entity is a claim about the schema and there's no migration behind it yet.
  Enums are the exception, because they're contract.
- Only two migrations exist: `V1__extensions.sql`, `V2__users.sql`.
- The repo is not under git yet.

## Rules that must not be broken

- Flyway owns the schema. `ddl-auto` stays `validate`.
- No login or signup endpoint, ever. Firebase handles identity; the API only
  verifies tokens.
- Entities are never serialized to clients. Every response is an explicit DTO.
- Keyset pagination only, never OFFSET. No total counts.
- Exact coordinates never leave the API except on admin-gated paths.
- `status` and `availability_state` are independent axes. Never collapse them.
- Identifiers, URLs, code and schema in English (US spelling). Only what a user
  reads is French. Enum labels live in `apps/web/src/lib/labels.ts` and nowhere
  else.
- Copy rules: French, vous, sentence case, no emoji, no exclamation marks,
  buttons verb-first.

## Still undecided — ask me if a step depends on one

- Firestore message mirroring (phase 04). The guide recommends REST-only first
  while still building the outbox.
- The client logo and photography binaries are missing from `design-system/`.
  Blocking for phase 08, survivable before it.

## What I want to do now

Start phase 01. Read `plans/01-backend-foundation.md` and
`plans/guides/01-backend-foundation.md`, tell me what's already done versus what
phase 01 still needs, propose the order, and then give me the first step.
```

---

## For later phases

Change the last section to:

```
## What I want to do now

Start phase NN. Read `plans/NN-*.md` and `plans/guides/NN-*.md`, check what the
previous phases actually left behind, tell me anything in the plan that no longer
matches the code, propose the order, and give me the first step.
```

## If you want it to work normally instead

Delete the whole *How I want to work* section. Claude Code will then edit files
directly, which is faster but means you read diffs rather than write code.
