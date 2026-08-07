# AGENTS.md

## Scope and source of truth

This file applies to the entire Friction repository.

- The current user request and a closer directory-level `AGENTS.md` are more specific.
- The implementation contract is the PRD bundle containing
  `00-CODEX-HANDOFF.md` through `13-DOGFOOD-AND-ITERATION.md`.
- Read the bundle's `README.md`, then every PRD in its listed order before coding.
  Re-read the owning PRDs before each milestone.
- Later documents refine earlier ones. Follow the narrower responsibility document
  when passages appear to conflict; do not combine them into a stricter hybrid.
- Do not edit the PRD merely to make implementation easier. Report a contradiction or
  propose a deliberate contract change separately.

## Product invariants

Friction is a personal, local-first feedback loop between one developer and coding
agents. Keep these decisions fixed during the PoC:

- Product and CLI name: `Friction` / `friction`.
- Codex is the primary harness; Claude Code is secondary.
- The CLI is deterministic and model-free.
- Private user-local storage is the only canonical store.
- Repository sharing is an explicit sanitized projection, never ordinary capture or a
  second canonical store.
- The product covers observed task cost from codebase design, unclear ownership,
  misleading abstractions, hidden invariants, duplicated knowledge, stale docs and
  guides, scripts, tests, dependencies, configuration, environment, tools, and
  harnesses—not only command failures.
- Teams, cloud services, background analysis, and public release work are deferred.
- The primary coding task always outranks friction capture.

## Execution order

For meaningful work:

1. Inspect repository state and applicable instructions.
2. Map the task to `12-IMPLEMENTATION-PLAN.md` and update a lightweight harness plan.
3. Trace the real production path, callers, data flow, side effects, persistence
   boundary, and meaningful failure paths.
4. Identify the owning module and invariant.
5. Implement one narrow vertical slice using only files needed by the active milestone.
6. Run focused verification and inspect the changed path and diff.
7. Run `npm run check` when the milestone is complete and report exact evidence before
   continuing.

Follow the milestone order unless the user explicitly changes it:

1. Scaffold and guardrails.
2. Safe capture.
3. Reads, lifecycle, export, purge, and doctor.
4. Setup engine and harness adapters.
5. Review and fix skills.
6. Repository projection.
7. Package and dogfood readiness.

Do not scaffold the full planned tree or build future-milestone abstractions early.

## Technical constraints

- Node.js 24 LTS, npm, ESM, strict TypeScript, one private unpublished package.
- Use `node:util.parseArgs`, `node:test` with `tsx`, and `tsc`.
- Authorized dev dependencies: `typescript`, `tsx`, and `@types/node`.
- Runtime dependencies remain zero. Stop and report before adding one.
- Do not add a CLI/schema/logging framework, SQLite, dependency injection container,
  plugin system, monorepo, generic repository layer, or public SDK.
- Prefer plain functions, explicit data, direct control flow, and thin command handlers.
- Services never call `process.exit`; domain types have no filesystem/process access.
- Security owns screening; repository owns Git context; storage owns event I/O;
  lifecycle owns folding/events; views own rendering; setup and publish own their
  separate mutations.
- Avoid broad barrels and dumping grounds such as `utils.ts`.

Every `.ts`, `.tsx`, `.js`, `.mjs`, and `.cjs` file in source, tests, and scripts has a
hard maximum of **300 physical lines**, including blanks and comments.

- Reconsider ownership around 250 lines and split by real responsibility.
- Never compress formatting, hide code, generate evasive code, or create mechanical
  `part-1` files to satisfy the limit.
- Keep `scripts/check-code-lines.mjs` authoritative and in `npm run check`.

## Privacy, storage, and mutation safety

Treat every agent-authored value as potentially sensitive.

- Apply byte bounds and high-confidence redaction before event construction,
  persistence, output interpolation, repository-preimage hashing, export, or publish.
- Never write an unredacted preimage to a temp file, log, error, backup, fixture,
  event, projection, or diagnostic.
- Use fixed safe errors. Never echo bodies, rejected secrets, raw remotes, absolute
  repository roots, environment values, or existing instruction contents.
- Private directories use `0700`; event and temp files use `0600` where supported.
- Never persist raw Git remotes. Public output omits repository keys, absolute paths,
  and internal event metadata.
- Safe Git attribution failure warns and stores `repository: null`; it does not block
  capture.
- Store one immutable validated JSON event per file. Do not add canonical JSONL,
  SQLite, a mutable index, or a cache in the PoC.
- `friction add` must never modify the current repository.
- Missing storage is a successful empty state for reads.
- Setup, publish, undo, and purge previews perform literally zero writes.
- Apply paths preserve unrelated bytes, reject unsafe symlinks/scope escapes, and
  recheck target preimages immediately before mutation.
- During development, exercise setup, publish, and purge only in isolated temporary
  homes and fixture repositories. Never mutate live user configuration or private data
  without explicit authorization.
- Use only synthetic secret canaries in tests.

## Domain and skill behavior

Record an observation when a concrete system, repository, instruction, design, or tool
property causes retry, backtracking, workaround, extra search, blocking, plausible
wrong evidence, avoidable delay, or unclear ownership.

- The body is the only required authored field. Omit optional metadata rather than
  guess.
- Record one distinct issue per task by default. A same-task repeat must add materially
  different evidence or impact; preserve later repeats across tasks and days.
- Do not add hidden deduplication, task IDs, cooldowns, embeddings, or semantic
  clustering to the CLI.
- Do not record accomplishments, routine mistakes without a missing guardrail, tracked
  bugs, unsupported style opinions, speculative redesign wishes, secrets, transcripts,
  large output, or Friction's own capture failure.
- A claimed cause is a hypothesis until review verifies the owning code, docs, config,
  script, or instruction.
- Resolve and reopen append lifecycle events; they never rewrite observations.
- Capture success never echoes the submitted body.
- JSON mode emits exactly one versioned envelope. `schema` describes the machine
  contract; `doctor` diagnoses and never silently repairs.
- `stats` reports structural facts only. Analysis and prioritization belong to the
  explicit review skill.
- `export` is a private read projection. `publish` is separate, preview-first,
  sanitized, and current-repository-only.

Verify current Codex and Claude Code setup rules from official documentation while
implementing; do not rely on remembered paths.

- Setup apply/undo must be reversible, idempotent, and safe around unrelated content
  and changed preimages. Never auto-install the CLI when absent from `PATH`.
- Ship separate `friction-review` and `friction-fix` skills.
- Review may inspect code but never modifies code, configuration, projections, or
  lifecycle state.
- Fix requires explicit user authorization, changes only the named scope, verifies the
  production path, and resolves only records covered by the verified fix.
- Never add automatic transcript review, hooks, background capture, model API calls,
  subagent swarms, issue submission, commits, or publishing.

## Testing and verification

Tests protect consequential contracts, not every branch.

- Target **12–18 automated tests total**; hard ceiling **24** without owner approval.
- More than four cases for one module require a written production-risk justification.
- Combine assertions around one production seam; do not add coverage thresholds or
  tests merely because a file changed.
- Usually do not test exact help formatting, every flag order, TypeScript behavior,
  private helpers, call counts, every duration/regex, broad snapshots, hypothetical
  schemas, impossible collisions, unsupported platforms, or theoretical races.
- Prefer real temp files, child processes, temporary Git repositories, fake homes, and
  rendered event bytes. Inject only clock, IDs, version source, or a narrow Git fallback
  when needed.
- Do not mock the event store in command acceptance tests or mislabel simulated tests.

Prioritize the PRD scenarios: capture receipt, secret boundary, lifecycle fold,
repository attribution, eight-process capture, setup safety, publish safety, JSON
contract, doctor, and packaged smoke.

Verification order:

1. Focused relevant test or command.
2. Typecheck for changed contracts.
3. Line checker for code changes.
4. Production-path and diff review.
5. `npm run check` at milestone completion.
6. `npm run pack:smoke` at Milestone 6 and final completion.

## Scope, stop conditions, and completion

Do not add teams, accounts, sync, cloud storage, telemetry, dashboards, daemons,
watchers, hooks, transcript ingestion, MCP, IDE extensions, automatic clustering,
embeddings, model clients, autonomous fixes, release machinery, marketing assets, or
speculative migrations/high-scale work during the PoC.

Do not commit, merge, push, force-push, publish, deploy, reserve a package name, alter
live configuration, call paid/live services, or perform destructive Git/data actions
without explicit authorization. Do not repair or reformat unrelated code.

Stop and report when a production dependency appears necessary; official harness
behavior contradicts the setup contract; a safe atomic primitive is unavailable;
redaction would retain a raw preimage; a requirement creates a second canonical store;
tests would exceed 24; a cohesive file cannot stay under 300 lines; or an unresolved
choice risks private data, configuration overwrite, durable public behavior, or an
irreversible action.

A stop report names the blocked requirement, inspected evidence, smallest viable
options, and recommended least-risk path.

At each milestone and final completion, report:

1. What changed and which PRD responsibility it satisfies.
2. The production path or invariant addressed.
3. Exact commands and results.
4. Real, mocked, simulated, and unverified boundaries.
5. Current-change failures separately from baseline or unrelated failures.
6. Remaining milestone work without claiming it already exists.

Do not claim all tests pass unless every applicable suite was run and passed.
