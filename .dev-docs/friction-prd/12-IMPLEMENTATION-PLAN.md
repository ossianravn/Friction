# Ordered implementation plan for Codex

## General sequencing rule

Work milestone by milestone. Do not scaffold the entire planned tree before it is
needed. At each milestone:

1. Re-read the owning PRD sections.
2. Update the lightweight plan.
3. Implement one vertical slice at a time.
4. Run focused checks.
5. Review the production path and diff.
6. Run `npm run check` when the milestone is complete.
7. Report exact evidence before continuing.

Do not make commits, publish packages, alter live user configuration, or touch
repositories outside the implementation workspace unless explicitly authorized.

## Milestone 0 — repository scaffold and guardrails

Create:

- package manifest and lockfile;
- strict ESM TypeScript configuration;
- build configuration and `dist` ignore;
- `.editorconfig` and minimal `.gitignore`;
- bin entrypoint skeleton;
- `scripts/check-code-lines.mjs`;
- scripts listed in `03` with placeholders only when a later milestone owns behavior;
- minimal repository README explaining PoC development commands.

Acceptance:

- `npm install` succeeds with only authorized dev dependencies;
- `npm run typecheck`, build, and line check execute;
- packaged bin can print a temporary version response;
- no code file, including tests and scripts, exceeds 300 lines.

Do not add all commands or tests yet.

## Milestone 1 — safe capture vertical slice

Implement in this order:

1. Fixed error registry and CLI runner result model.
2. Clock and ID boundaries.
3. Screened text type and pure redactor.
4. Capture input validation and byte limits.
5. Friction home path and permissions.
6. Git repository discovery and safe identity.
7. Observation event runtime validation/serialization.
8. Atomic one-file event store.
9. `add` command human and JSON receipts.
10. Minimal `schema` describing implemented contract.

Add only the capture, secret-boundary, repository, and eight-process concurrency tests
needed for this slice.

Acceptance:

- stdin capture works from a Git subdirectory and outside Git;
- success never echoes body;
- synthetic secret canary does not reach event bytes or output;
- eight concurrent captures survive;
- repository write tree remains unchanged;
- capture errors are nonzero and safe.

## Milestone 2 — reads and lifecycle

Implement:

1. Event loading and runtime validation.
2. Deterministic lifecycle folding.
3. Scope, status, duration, and limit parsing.
4. `list` human and JSON views.
5. Structural `stats`.
6. `resolve` and `reopen`.
7. Private `export` to stdout and safe file target.
8. `purge` preview/apply.
9. Storage-focused `doctor` checks.
10. Expand `schema` to the full current contract.

Acceptance:

- missing store is healthy empty state;
- corrupt events are warned/skipped and surfaced by doctor;
- resolve/reopen are immutable and idempotent;
- export omits private identity and absolute paths;
- purge previews without writing and deletes only the selected private history on
  apply.

Do not implement semantic clustering or search.

## Milestone 3 — setup mutation engine

Implement shared setup primitives first:

1. Canonical scope resolution.
2. `lstat` path-component safety.
3. In-memory plan and safe summaries.
4. zero-write preview;
5. digest recheck and bounded same-target lock;
6. atomic apply and exact undo;
7. all-target preflight to prevent partial mutation.

Then implement adapters:

8. Codex user/repo instruction target and skill paths.
9. Claude Code user/repo owned rule and skill paths.
10. Generic print-only adapter.
11. Setup state in `doctor`.

Use current official harness documentation while coding. Record the documentation URLs
and observed path rules in the implementation report, not in runtime output.

Acceptance:

- preview creates nothing;
- apply/reapply/undo are byte-safe and idempotent;
- unrelated instruction content survives exactly;
- changed preimage and symlink scope escape fail without partial changes;
- missing `friction` on PATH is a warning, not an auto-install action.

## Milestone 4 — shipped review and fix skills

Write the packaged assets from `10`:

1. `friction-review/SKILL.md`.
2. Review policy and report format references.
3. `friction-fix/SKILL.md`.
4. Fix and verification policy references.
5. Capture instruction asset shared by setup adapters.

Manually review assets for:

- no automatic invocation;
- clear review/fix authorization boundary;
- codebase design and stale docs coverage;
- skeptic verification;
- proportional tests and scoped fixes;
- truthful lifecycle handling;
- no mention of private implementation context not intended for users.

Normally do not add application tests for documentation assets. Setup integration tests
already prove installation bytes.

## Milestone 5 — explicit repository projection

Implement:

1. strict projection allowlist;
2. existing JSONL validation;
3. ID selection and current-repository enforcement;
4. deterministic merge and render;
5. zero-write preview;
6. digest recheck and atomic apply;
7. publish output and schema metadata.

Acceptance:

- publish preview creates no `.friction` directory;
- selected current-repo observations project safely;
- existing valid records remain;
- same ID updates, duplicates do not accumulate;
- changed or malformed target is refused;
- local lifecycle and private files are unchanged.

## Milestone 6 — package and dogfood readiness

Complete:

1. Package `files` and bin metadata.
2. `npm pack` smoke script.
3. Clean install in a temporary home.
4. Best-effort npm/Yarn/pnpm/Bun runner checks where present.
5. Final README with install-from-tarball, setup, capture, review, fix, export, publish,
   privacy, and purge guidance.
6. Minimal CI for supported Node 24 on one Linux runner, only if repository policy
   permits CI creation.
7. Full `npm run check` and `npm run pack:smoke`.
8. Final code-line report.
9. Final manual inspection of tarball contents for accidental private or development
   files.

Do not publish, create a release, reserve a package name, deploy anything, or enable
telemetry.

## Milestone 7 — public npm release readiness

This milestone is separately authorized after the PoC and native-Windows gates passed.

Complete:

1. Rename the package to `@ossianravn/friction` while preserving the `friction` binary.
2. Set the first public version to `0.1.0` and keep CLI/package versions synchronized.
3. Add the approved MIT license and complete public npm metadata.
4. Replace source-tarball installation guidance with npm and pnpm consumption guidance.
5. Add a manual GitHub Actions trusted-publishing workflow with no long-lived token.
6. Verify npm install/exec and pnpm global/dlx behavior from the exact local tarball.
7. Run `npm run release:check` and inspect the complete packed file list.
8. Record exact evidence in `.dev-docs/friction-npm-release/README.md`.

Acceptance:

- no runtime dependency or repository package-manager migration is introduced;
- `npm publish --dry-run` targets the public scoped package and includes only intended
  files;
- npm and available pnpm runners execute the packaged `friction` binary;
- the existing cross-platform CI contract remains unchanged;
- the first registry publish, commit, push, and trusted-publisher configuration remain
  undone until separately authorized.

## Stop conditions

Stop and report before proceeding when:

- a production dependency appears necessary;
- official harness behavior contradicts the setup design;
- a safe atomic primitive is unavailable on a supported platform;
- redaction would require storing a raw preimage;
- meeting a feature would force a second canonical store;
- test count would exceed 24;
- a code file cannot stay cohesive under 300 lines without changing the architecture;
- implementation encounters an irreversible or privacy-sensitive ambiguity.

A stop report must name the blocked requirement, inspected evidence, smallest options,
and recommended least-risk path. Do not silently replace the requirement.
