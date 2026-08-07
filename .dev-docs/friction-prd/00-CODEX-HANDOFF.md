# Codex handoff and execution contract

## Your assignment

Implement the Friction PoC in a new repository. Treat this bundle as the product and
engineering contract. Build the smallest coherent implementation that satisfies it.
Do not turn the PoC into a platform.

## Before writing code

1. Read every PRD file in the order listed in `README.md`.
2. Inspect the repository state. If the repository is empty, confirm that no hidden
   scaffold or existing package policy needs preservation.
3. Write a short, updated implementation plan mapped to the milestones in `12`.
4. Identify the production path for the first vertical slice:
   `argv/stdin -> validation -> redaction -> repository context -> event store -> safe receipt`.
5. Create only the files required for Milestone 0 and Milestone 1.
6. Do not begin setup adapters, skills, publication, or broad tests before the core
   capture path works.

## How to work

- Keep control flow direct and state explicit.
- Prefer plain functions and small modules over frameworks, dependency injection
  containers, registries, plugin systems, or generic repositories.
- Add an abstraction only when at least two real callers benefit or it protects a
  named boundary from this PRD.
- Keep validation, redaction, repository discovery, persistence, rendering, and
  orchestration separate when doing so gives each concern one clear owner.
- Make the smallest in-scope change for the active milestone.
- Review the final diff and production path after each milestone.
- Do not rewrite unrelated files or “prepare” speculative future architecture.

## Hard file-size rule

Every code file with extension `.ts`, `.tsx`, `.js`, `.mjs`, or `.cjs` must
remain at or below **300 physical lines**, including tests and scripts.

- Reconsider ownership when a file approaches 250 lines.
- Do not compress statements, remove useful whitespace, or create meaningless
  `part-1.ts` / `part-2.ts` splits.
- Split by responsibility: parsing, policy, persistence, rendering, or a command.
- The hard checker applies to source, tests, and scripts.
- Implement `scripts/check-code-lines.mjs` in Milestone 0 and run it in `npm run check`.

## Scope-control rules

Do not add any of the following unless a later user request explicitly authorizes it:

- web UI, TUI, dashboard, daemon, background watcher, account, telemetry, or cloud;
- team permissions, synchronization, organization concepts, or shared database;
- MCP server, native Codex tool, native Claude hook, or transcript ingestion;
- semantic embeddings, automatic clustering in the CLI, or a bundled model client;
- direct issue submission, automatic commits, automatic publishing, or release setup;
- SQLite, a database dependency, a CLI framework, a logging framework, or a schema
  framework;
- native Windows support beyond code that naturally works there;
- raw stderr, full command output, diffs, file contents, environment dumps, or
  transcripts as stored evidence;
- migration machinery for storage formats that have never shipped;
- a license, code of conduct, contributor policy, changelog, or public-release
  metadata before the owner chooses the repository’s distribution policy.

## Assumptions that are already decided

Do not pause to ask about these:

- Product name and CLI: `Friction` / `friction`.
- Runtime: Node.js 24 LTS, ESM, strict TypeScript, npm.
- Initial package is private and unpublished.
- Canonical storage is private user-local one-file-per-event JSON.
- “Hybrid” means private canonical storage plus explicit sanitized repository
  projection. It does not mean dual-write or two canonical stores.
- User scope is the default for setup.
- Codex and Claude Code are the first adapters; generic shell guidance is included.
- MacOS and Linux are PoC targets; WSL follows Linux behavior.
- A capture failure is visible but must not stop the agent’s primary coding task.
- Observation diagnoses are hypotheses until review verifies them.
- Repeated observations across sessions are useful signal. Duplicate spam within one
  task is not.

## Ambiguity policy

Ask a question only when an unresolved choice could expose private data, overwrite
user configuration, alter public behavior irreversibly, or make the storage contract
incompatible. Otherwise choose the narrowest safe interpretation, write the
assumption in the current plan, and continue.

Do not invent a “better” feature when the PRD is silent. Silence usually means omit it
from the PoC.

## Testing behavior

- Tests are evidence for explicit contracts, not a goal by themselves.
- Follow the total test budget and named scenarios in `11`.
- Do not add tests for every parser branch, flag permutation, operating system quirk,
  private helper, or theoretical race.
- Use one primary seam per risk.
- More than four cases for one module require a written risk justification in the
  implementation report.
- A table of redaction examples is one test, not dozens of individually named tests.
- Do not change production design solely to make a contrived test convenient.

## Completion reporting

At each milestone and at final completion, report:

1. What changed and which PRD responsibility it satisfies.
2. The production path or invariant protected.
3. Exact commands run and their results.
4. Which meaningful boundaries were real, mocked, simulated, or not exercised.
5. Any baseline or unrelated failures, separately from failures introduced by the
   current work.
6. Remaining milestone work without claiming future behavior already exists.

Do not claim “all tests pass” unless every applicable suite was actually run and
passed.
