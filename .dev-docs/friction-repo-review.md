# Friction repository review and corrective implementation plan

**Reviewed artifact:** `Friction-main.zip`
**Review date:** 2026-08-07
**Original verdict:** The reviewed repository was not ready for personal dogfood because four safety/correctness defects blocked real private data and live harness configuration.
**Fix-pass verdict:** All fourteen original and follow-up findings are addressed. The prescribed Node 24 checks and packaged smoke pass. The corrected tree is ready for owner review and personal-dogfood use; it remains uncommitted.

## Implementation progress

**Fix pass started:** 2026-08-07
**Current phase:** Complete
**Overall status:** All original and follow-up findings are implemented and verified.

- [x] F-01 — fail-closed implicit repository reads
- [x] F-02 — custom `CODEX_HOME` outside `$HOME`
- [x] F-03 — Codex precedence preconditions
- [x] F-04 — fail-closed purge on corrupt stores
- [x] F-05 — canonical loaded-event constraints
- [x] F-06 — known managed-asset upgrades
- [x] F-07 — setup staging directory cleanup
- [x] F-08 — complete command help
- [x] F-09 — accurate machine schema
- [x] F-10 — command-neutral `io_error`
- [x] F-11 — child-process stdin `EPIPE` handling
- [x] F-12 — distinguish outside Git from ordinary Git command failure
- [x] F-13 — propagate identity-critical remote discovery failures
- [x] F-14 — document fail-closed implicit read scope

### Follow-up review progress

- F-12 through F-14 — **implemented and verified**.
  - The bounded Git process boundary classifies only Git's exact C-locale outside-repository diagnostic as `not-repository`; all other nonzero, interrupted, overflow, signal, and spawn outcomes remain attribution failures. Raw stderr stays inside the boundary and is never returned or rendered.
  - Remote enumeration and selected-remote URL failures now propagate as `repository-unavailable`; only successful absence or ambiguity selects local common-directory identity.
  - The shared list/stats/export contract now states that `all` is the implicit default only outside Git and that unavailable attribution fails with `not_found`; both human help and schema inherit the same note.
  - The existing privacy acceptance scenario now covers real malformed Git configuration, a narrowly simulated `remote get-url` failure, warning-only capture with null attribution, fail-closed default list/stats/export, and explicit `--repo all` access.
  - Focused regression: `node --import tsx --test test/acceptance/privacy-regressions.test.ts` passed 2/2.
  - Final checks on Node `v24.14.0` / npm `11.9.0`: `npm run check` passed 12/12 tests plus line check, typecheck, and build; `git diff --check` passed; `npm run pack:smoke` passed after registry access was authorized. The suite remains at 12 tests; all 83 code files remain within 300 lines, with the expanded privacy acceptance file largest at 297.

### Fix-pass evidence

- Phase A — **passed** on Node `v24.14.0` and npm `11.9.0`.
  - `npm ci`: 7 packages installed, 0 vulnerabilities.
  - `npm run check:lines`: 76 files checked, maximum 300 lines.
  - `npm run typecheck`: passed.
  - `npm test`: 12/12 tests passed.
  - `npm run build`: passed.
  - `npm run pack:smoke`: passed.
  - Environment note: npm printed a pre-existing warning for the `http-proxy` config. The first sandboxed install/smoke attempt could not reach the registry; the exact commands passed once registry access was authorized.
- Phase B / F-01 — **implemented and focused test passed**.
  - Git discovery now distinguishes outside-repository, safely attributed repository, and attribution-unavailable states; interrupted Git commands cannot masquerade as ordinary non-repository results.
  - Implicit current-scope reads fail with `not_found` when attribution is unavailable; explicit `--repo all` remains available; capture remains non-blocking with a warning.
  - `node --import tsx --test test/acceptance/privacy-regressions.test.ts`: 2/2 tests passed, including default `list`, `stats`, and `export` isolation.
- Phase B / F-04 and F-05 — **implemented and focused tests passed**.
  - Event construction, loading, publication validation, repository metadata, lifecycle input, and schema now share canonical UTF-8 byte limits. Loaded events require real UTC millisecond timestamps, non-empty bounded authored text, and exact repository/redaction keys before re-screening and public use.
  - Purge refuses any unhealthy event corpus both during planning and immediately before deletion, while retaining per-file byte and existence rechecks.
  - Focused privacy, doctor, lifecycle, export/purge, and publish run: 6/6 tests passed.
  - `npm run typecheck`, `npm run check:lines`, and `git diff --check`: passed; 78 code files remain within 300 lines.
- Phase C / F-02, F-03, F-06, and F-07 — **implemented and focused tests passed**.
  - Setup plans now carry per-target canonical roots, a deterministic multi-root lock identity, and explicit Codex precedence preconditions covering both `AGENTS.override.md` and `AGENTS.md`.
  - Apply performs target/root/precondition preflight before target writes, creates parents one component at a time, stages all bytes, rechecks, and removes newly created empty directories after a pre-commit failure.
  - Adapter-owned assets use stable IDs and exact known SHA-256 digests; known prior bytes map to update/remove while unknown content remains a conflict.
  - The combined setup acceptance scenarios cover an external sibling `CODEX_HOME`, user-skill placement, repeat/undo, manual conflicts, precedence changes after planning, and scope/symlink safety: 2/2 tests passed.
  - `npm run typecheck`, `npm run check:lines`, and `git diff --check`: passed; 81 code files remain within 300 lines.
  - Current Codex precedence and skill locations were rechecked against official OpenAI documentation before implementation.
- Phase D / F-08 through F-11 — **implemented and milestone checks passed**.
  - One static CLI contract now owns command purposes, syntax, options, safety notes, and explicit effect flags used by help and schema.
  - Schema separates all three event shapes, private materialized and public record shapes, and the non-canonical published projection; it imports canonical limits, enums, errors, exit codes, and the complete environment inventory.
  - Generic `io_error` is now `An I/O operation failed.` and non-retryable.
  - Test and package-smoke process helpers ignore stdin when unused, attach piped-stdin error listeners before writing, ignore only `EPIPE`, and settle once.
  - Updated `npm run pack:smoke`: passed with help/schema contract assertions. Updated full `npm test`: 12/12 passed.
- Phase E — **final verification passed** on Node `v24.14.0` and npm `11.9.0`.
  - Final ordered run: `npm run check:lines`, `npm run typecheck`, `npm test` three times, `npm run build`, and `npm run check` all passed.
  - Each standalone test run passed 12/12; the additional suite inside `npm run check` also passed 12/12. No `EPIPE`, unhandled rejection, or process warning occurred.
  - `npm run pack:smoke` passed three consecutive final runs.
  - Line check: 83 code files checked; largest code file is 243 physical lines, below the 300-line limit. `git diff --check` passed.
  - Independent CLI check: an attribution-unavailable repository returned `not_found` for an implicit read, while explicit `--repo all` returned both isolated records.
  - Independent setup check: a missing custom `CODEX_HOME` outside `$HOME` previewed with zero writes, applied instructions under that root and skills under `$HOME/.agents/skills`, then undid successfully.
  - Acceptance checks exercised precedence change after planning, corrupt-store purge refusal, overlong-event rejection, known-prior asset decisions, and preview no-write behavior with real temporary files and directories.
  - Tarball dry-run listed only required package metadata/documentation plus `dist`, `assets`, and `skills` (81 entries). Local-tarball version checks passed through npm exec, Yarn 4.12.0, pnpm 11.20.0 via Corepack, and Bun 1.2.20.
  - Real boundaries: Node 24 child processes, temporary private homes, regular files and modes, real Git repositories, setup mutations in fake homes/repositories, npm tarball installation, and four package runners. No event-store or filesystem mocks were used.
  - Unverified boundaries: non-cooperating editor races during the narrow commit window, power loss, unsupported platforms, and network filesystems. These remain outside the PoC contract.
  - Environment notes: npm continued to print the pre-existing unknown `http-proxy` config warning. One dry-run manifest attempt hit the sandboxed read-only default npm cache and blocked registry access; it passed with an isolated `/tmp` cache and authorized network access.
  - Codex behavior was checked against [official AGENTS.md precedence documentation](https://developers.openai.com/codex/guides/agents-md) and [official local skill location documentation](https://developers.openai.com/codex/skills).

Verification evidence for every completed phase is recorded above. The ordered plan in section 4 remains the source of truth for the completed sequence.

## 1. Executive assessment

The implementation got the central product shape right:

- one private, user-local canonical event store;
- one immutable JSON file per event;
- explicit, sanitized repository projection rather than dual-write capture;
- deterministic, model-free CLI with zero runtime dependencies;
- pre-persistence redaction and re-screening of loaded legacy values;
- separate ambient capture instructions, read-only review skill, and authorized fix skill;
- first-class design, ownership, stale-documentation, misleading-abstraction, and false-evidence friction;
- preview-first setup, publish, and purge commands;
- strict TypeScript modular boundaries;
- 12 focused tests, a 300-line guard, CI, and a local package smoke test.

The core architecture should remain. Do **not** replace it with SQLite, a framework, hooks, transcript mining, a daemon, a service, or a generic transaction layer.

### Release-blocking findings

1. A read from a Git repository whose safe identity cannot be computed silently defaults to **all repositories**.
2. A valid user-defined `CODEX_HOME` outside `$HOME` is rejected.
3. Codex instruction precedence can change after setup planning, causing setup to report success after writing a shadowed `AGENTS.md`.
4. Purge can delete the valid history for an observation while leaving a malformed event file that may reference the same observation.

### Required before broader PoC iteration

5. Loaded events do not enforce the byte and semantic constraints declared by the domain contract.
6. Adapter-owned rule and skill assets cannot be upgraded from a known previous shipped version.
7. Setup can create parent directories before all targets are staged successfully and can leave those directories after a later failure.
8. Help output does not meet the documented self-orientation contract.
9. `schema` is incomplete and partly misleading.
10. The shared `io_error` message is capture-specific even when raised by export, setup, publish, purge, or reads.
11. The child-process helpers have an unhandled stdin `EPIPE` race that can make the suite and package smoke flaky.

## 2. Review method and verification limits

I inspected the complete source tree, tests, package metadata, CI, shipped assets, local repository instructions, and all PRD documents. I traced capture, repository attribution, event loading/folding, lifecycle, export, projection, setup, doctor, CLI parsing/output, and package smoke paths.

### Checks completed

- `scripts/check-code-lines.mjs`: **passed**, 76 code files checked, maximum 300 lines.
- Test count: **12**, inside the requested 12–18 target.
- Strict typecheck and build: **passed in a review copy** with the globally available TypeScript 5.8.3 and mounted Node typings.
- Package smoke: **passed in a review copy**.
- All 12 tests: **passed in a review copy** after two environment-only adaptations:
  - tests invoked the compiled `dist` binary because the locked `tsx` package could not be installed in this environment;
  - the compiled doctor runtime check was changed from Node 24 to Node 22 only for the review run.
- The test runner also required an `EPIPE` handler; that exposed finding 11 rather than changing production behavior.

### Checks that remain unverified in the exact supported environment

- `npm ci` could not complete because the configured internal npm mirror returned 404 for `undici-types@7.18.2`.
- The environment provides Node `22.16.0`; the repository supports Node 24 or newer.
- Therefore the exact locked TypeScript 7 / `tsx` / Node 24 invocation of `npm run check` was not executed here.
- Yarn, pnpm, and Bun local-tarball runners were not available for verification.

These are review-environment limits, not evidence of repository defects. The final fix pass must rerun the exact commands under Node 24 with a working registry.

---

# 3. Detailed findings and fixes

## F-01 — Blocker: implicit repository reads can expose the whole private corpus

### Evidence

`src/views/query.ts:44-48` chooses:

```ts
const selectedScope = filters.repo ??
  (repository.context === null ? "all" : "current");
```

`src/repository/discover.ts` uses `context: null` for two materially different states:

- the current directory is not in a Git repository;
- Git found or may have found a repository, but safe attribution was unavailable.

The PRD requires:

- outside Git: default to `all`;
- inside Git: default to `current`;
- if current repository identity cannot be established safely: fail rather than guess.

### Reproduction

I captured one observation in a normal repository and one in a repository whose path deliberately triggered attribution screening. Running default `friction list --status all --json` from the unsafe repository returned:

```json
{
  "scope": { "repo": "all" },
  "count": 2
}
```

It included the observation from the unrelated normal repository. A warning was present, but the privacy-sensitive scope had already widened.

### Required implementation

1. Replace `RepositoryDiscovery` with a discriminated result that preserves repository-presence state. Keep it small; do not add a general Git model.

   Suggested shape:

   ```ts
   type RepositoryDiscovery =
     | { state: "not-repository"; replacementCount: 0 }
     | {
         state: "repository";
         context: RepositoryContext;
         replacementCount: number;
       }
     | {
         state: "repository-unavailable";
         replacementCount: number;
       };
   ```

2. Update `runGit` so timeout and output-overflow are not reported as an ordinary command failure. At minimum distinguish:

   - process unavailable;
   - timed out / killed / overflowed;
   - normal nonzero command result;
   - success.

   `rev-parse` normal nonzero may mean outside Git. A timeout, spawn failure, or overflow must become `repository-unavailable`, never `not-repository`.

3. Update capture behavior:

   - `repository` -> store safe context;
   - `not-repository` -> store `repository: null`, no warning;
   - `repository-unavailable` -> store `repository: null`, safe warning.

   Capture must remain non-blocking when attribution fails safely.

4. Update read-scope resolution in `src/views/query.ts`:

   - explicit `--repo all` -> all, in any directory;
   - explicit `--repo current` -> require `state: "repository"`, otherwise `not_found`;
   - no `--repo` + `not-repository` -> all;
   - no `--repo` + `repository` -> current;
   - no `--repo` + `repository-unavailable` -> `not_found`.

5. Use the same state in doctor so its wording stays truthful.

6. Do not “fix” this by treating every null context as current with zero results. That would hide a failure and make the displayed scope dishonest.

### Minimal test change

Extend `test/acceptance/privacy-regressions.test.ts`, specifically the existing redaction-sensitive local Git path case:

1. Capture another observation in a separate safe repository using the same private home.
2. Run default `list`, `stats`, and `export` from the redaction-sensitive repository.
3. Assert each returns `not_found` and never includes the safe repository body.
4. Assert explicit `--repo all` still succeeds and contains both records.

Keep this inside the existing test case; do not add three separate tests.

### Acceptance criteria

- Default reads can never widen from an intended current-repository context to all repositories.
- Explicit `--repo all` remains available.
- Capture still succeeds with a safe warning when repository attribution is unavailable.

---

## F-02 — Blocker: custom `CODEX_HOME` outside `$HOME` is rejected

### Evidence

`src/setup/plan.ts:93-103` sets one `scopeRoot` to the user home for all user-scope targets. The Codex instruction target is then derived from `CODEX_HOME`.

`src/setup/files.ts:23-32` correctly rejects targets outside that single scope root. As a result, a legitimate custom `CODEX_HOME` in a sibling path produces `setup_conflict` even in preview.

### Reproduction

With:

```text
HOME=/tmp/example/user-home
CODEX_HOME=/tmp/example/custom-codex-home
```

`friction setup codex --json` exited 4 with `setup_conflict`.

### Required implementation

Do **not** weaken `assertWithinScope`. The problem is the plan model, not the safety check.

1. Add a per-target canonical scope root:

   ```ts
   type SetupTarget = {
     scopeRoot: string;
     path: string;
     // existing fields
   };
   ```

2. Replace `SetupPlan.scopeRoot` with a small collection of canonical roots or one deterministic lock identity:

   ```ts
   type SetupPlan = {
     // existing fields
     lockRoots: string[];
     targets: SetupTarget[];
     preconditions: SetupPrecondition[];
   };
   ```

3. Resolve roots as follows:

   - Codex user instructions: canonical `CODEX_HOME`, defaulting to `$HOME/.codex`.
   - Codex user skills: canonical user home, with targets under `$HOME/.agents/skills`.
   - Claude user rule and skills: canonical user home.
   - Repository-scope targets: canonical Git worktree root.

4. Add one narrow helper for a possibly missing selected root:

   - resolve the requested absolute path;
   - walk upward to the nearest existing ancestor;
   - reject existing symlink or non-directory components;
   - `realpath` the nearest existing ancestor;
   - append the missing suffix;
   - repeat component checks during apply before creating anything.

5. Every call to `inspectSetupFile`, parent validation, stage, and commit must use `target.scopeRoot`, not one plan-wide root.

6. Build one private setup lock key from the sorted canonical root set plus harness/scope. One lock is sufficient; do not introduce a multi-lock framework.

### Minimal test change

Modify the first setup acceptance test so `CODEX_HOME` is a sibling of, rather than a child of, `HOME`.

Verify:

- preview writes neither tree;
- apply writes the Codex managed block under custom `CODEX_HOME`;
- skills still land under `$HOME/.agents/skills`;
- reapply and undo remain idempotent;
- no target can escape its own root.

### Acceptance criteria

A valid custom `CODEX_HOME` may live anywhere the user can safely manage, while skills continue to use the user skill location and all scope/symlink protections remain intact.

---

## F-03 — Blocker: Codex precedence can change after planning

### Evidence

`src/setup/plan.ts:33-50` chooses `AGENTS.override.md` or `AGENTS.md` only during plan construction. Only the selected target is included in the plan.

`src/setup/apply.ts:63-70` rechecks planned targets, but it does not re-evaluate Codex precedence.

### Reproduction

1. Build a repo-scope Codex plan when no override exists; the plan selects `AGENTS.md`.
2. Create a non-empty `AGENTS.override.md` before apply.
3. Apply succeeds, creates a Friction block in `AGENTS.md`, installs skills, and reports success.
4. The new override shadows the file Friction modified.

This directly violates the requirement to conflict rather than claim installation into a shadowed file.

### Required implementation

1. Add an explicit setup precondition type, not an ad hoc callback:

   ```ts
   type CodexInstructionPrecondition = {
     kind: "codex-instruction-precedence";
     scopeRoot: string;
     overridePath: string;
     overrideSnapshot: FileSnapshot;
     agentsPath: string;
     agentsSnapshot: FileSnapshot;
     selectedPath: string;
   };
   ```

2. During planning, snapshot **both** instruction candidates before selecting the active path.

3. Store the selected path and both snapshots in the plan.

4. Under the setup lock, before any directory creation or temp-file write:

   - re-snapshot both candidates;
   - require both snapshots to match the plan;
   - recompute the active target;
   - require it to equal `selectedPath`.

5. Repeat this precedence check after staging and immediately before committing instruction mutations.

6. For undo, continue inspecting both candidates because Friction may previously have installed a block in either one. Removing a known block from both is acceptable, but every candidate must still be preimage-checked.

7. Do not solve this by writing both files during apply. That would violate active-precedence ownership and create unnecessary instruction duplication.

### Minimal test change

Extend `test/acceptance/setup.test.ts` in the existing preimage-race test:

- build a plan with no override;
- create non-empty `AGENTS.override.md` after planning;
- assert apply returns `setup_conflict`;
- assert `AGENTS.md`, `.agents/`, and the override remain exactly as they were at apply time.

Keep the existing direct `AGENTS.md` preimage-race assertion as a separate subcase in the same test.

### Acceptance criteria

Setup may report success only when the instruction file it planned is still the active Codex file at commit time.

---

## F-04 — Blocker: purge is not fail-closed around malformed files

### Evidence

`src/lifecycle/purge.ts:26-39` treats a load finding as relevant only when:

- the parser extracted the target `observationId`; or
- the finding is associated with a filename already known to contain a valid matching event.

A malformed JSON file may contain the target ID but expose `observationId: null` in its finding. Purge then deletes every valid matching event and leaves the malformed target-related file behind.

### Reproduction

I added one valid observation, then created a malformed event file containing its ID. `friction purge ID --apply --json` exited 0, deleted the valid observation file, and left the malformed file in the canonical event directory.

### Required implementation

For the PoC, use the conservative rule:

1. Load and fold the store.
2. If **any** event-file finding or corpus finding exists, refuse purge with `corrupt_store` before deletion.
3. Tell the user through the existing fixed error and `doctor`; do not include corrupt bytes.
4. Re-run the same full-health check immediately before deletion.
5. Keep the existing matching-file byte and existence rechecks.

Do not add a raw-text ID scanner and claim it proves a malformed file is unrelated. Escaped JSON, broken encoding, or partial bytes would make that assurance false. A more selective forensic purge can be considered only after real dogfood data justifies it.

### Minimal test change

Extend the existing export/purge acceptance test:

- create one malformed event file before purge apply;
- assert apply returns `corrupt_store`;
- assert every valid target event and malformed file still exists;
- remove the malformed fixture;
- assert purge then succeeds as already tested.

### Acceptance criteria

Purge never claims full deletion from a store whose complete target relationship cannot be validated safely.

---

## F-05 — High: loaded events do not enforce declared bounds or real timestamps

### Evidence

`src/domain/events.ts:113-199` verifies basic types and regex shapes but does not enforce the PRD limits for:

- body: 4,096 UTF-8 bytes;
- model: 128 bytes;
- repository name: 255 bytes;
- branch: 512 bytes;
- relative cwd: 2,048 bytes;
- lifecycle note: 2,048 bytes;
- verification: 512 bytes.

It also accepts syntactically shaped but impossible timestamps such as month 13. A hand-edited, old, or independently produced event can therefore enter list, stats, export, and publish paths despite violating the declared contract.

I confirmed that a 5,000-byte observation body in a hand-written event file was loaded with no warning and returned by `list`.

### Required implementation

1. Move canonical limits into `src/domain/limits.ts` so capture, lifecycle, repository, event validation, projection validation, and schema import the same constants.

2. Keep `src/domain/events.ts` focused on types/enums. Move runtime event validation to a cohesive `src/domain/event-validation.ts` if adding honest checks would push `events.ts` toward the line limit.

3. Add pure helpers:

   ```ts
   fitsUtf8(value, maximumBytes)
   isRfc3339UtcMilliseconds(value)
   hasExactKeys(value, keys)
   ```

   Timestamp validation should require both the fixed shape and:

   ```ts
   new Date(value).toISOString() === value
   ```

4. Enforce the specified limits on loaded and pre-write events.

5. Require non-empty observation bodies and non-empty optional authored strings when present. Do not trim or mutate loaded values during validation.

6. Validate exact nested keys for repository and redaction objects. Continue the existing policy for unknown top-level properties: load with a finding only when the known schema remains otherwise valid.

7. Keep re-screening after structural validation and before public use.

8. Reuse the same limits in `isPublishedObservation`; remove duplicated numeric literals.

### Minimal test change

Extend the existing doctor test with one valid-shape event whose body exceeds 4,096 bytes or whose lifecycle note exceeds its bound.

Assert:

- normal reads skip it and return an event-finding warning;
- doctor reports `invalid-event` without body content;
- no public view contains the overlong payload.

One field is enough to protect the shared validator. Do not create a matrix for every limit.

### Acceptance criteria

The runtime validator, capture validator, projection validator, and schema all describe and enforce one canonical set of constraints.

---

## F-06 — High: owned setup assets cannot be upgraded safely

### Evidence

`src/setup/target-plan.ts:10-40` handles an existing adapter-owned file as:

- exact current bytes -> `noop`;
- any different bytes -> `conflict`.

Therefore `MutationState: "update"` is unreachable for owned files. A later Friction version cannot update a previously shipped Claude rule or either installed skill, even when the old bytes are known to be Friction-owned.

The setup contract explicitly distinguishes known managed bytes from user-modified bytes.

### Required implementation

Keep this deliberately small and explicit.

1. Give each adapter-owned asset a stable asset ID, for example:

   ```text
   claude-rule
   friction-review/SKILL.md
   friction-review/references/review-policy.md
   ...
   ```

2. Add a small `src/setup/managed-assets.ts` registry containing known shipped SHA-256 digests per asset ID.

3. The registry must include the current digest. On future content changes, retain only the small set of prior released digests still supported for direct upgrade/undo.

4. Change `planOwnedFile` to accept the asset ID and known digest set:

   - missing -> create;
   - equals desired -> noop;
   - equals a known prior managed digest -> update on apply, remove on undo;
   - otherwise -> conflict.

5. Never infer ownership from path, YAML frontmatter, filename, or partial content.

6. Do not introduce a migration framework, backup copies, or fuzzy matching.

### Minimal test change

In the existing setup acceptance test, add one fixture representing a known prior managed digest and verify it becomes `update` and applies. Retain the existing manually changed Claude rule case and verify it remains a conflict.

If no prior released bytes exist yet, expose the decision function to the test with a synthetic known prior digest. Keep it one assertion group, not a new suite.

### Acceptance criteria

Known Friction-owned older content upgrades cleanly; unknown user-modified content is never overwritten or deleted.

---

## F-07 — Medium: setup mutates directory state before all staging succeeds

### Evidence

`src/setup/apply.ts:73-107` calls recursive `mkdir` per target while staging. If a later target fails to stage, temp files are removed, but newly created parent directories remain.

This conflicts with the plan’s requirement to discover precondition conflicts before mutation and stage all desired bytes first. Recursive creation also makes parent-component race reasoning less clear.

### Required implementation

Refactor `applySetupPlan` into explicit phases without building a generic transaction abstraction:

1. Acquire the private setup lock.
2. Validate all target snapshots, target roots, symlink components, and Codex precedence preconditions with **zero target writes**.
3. Compute the exact missing parent directories for every non-noop write target.
4. Create missing directories one component at a time:
   - `lstat` after each creation;
   - reject symlink/non-directory;
   - record only directories created by this invocation.
5. Stage every desired file into a same-directory exclusive temp file.
6. Re-run all target snapshots and plan preconditions.
7. Commit targets in deterministic path order.
8. On failure before the first committed target:
   - remove staged temp files;
   - remove newly created empty directories deepest-first.
9. If an unexpected failure occurs after one target has committed, return the safe I/O error and report no all-or-nothing claim. Do not attempt broad rollback of user configuration.

Use `target.scopeRoot` from F-02 throughout.

### Minimal test change

Extend the existing setup race test with a late staging conflict and assert newly created `.agents` parent directories are absent afterward. Do not add a generalized fault-injection library; one deliberately conflicting later target is sufficient.

### Acceptance criteria

A conflict or staging failure before commit leaves target file bytes and newly planned parent-directory state unchanged.

---

## F-08 — Medium: command help is too sparse

### Evidence

`src/cli/run.ts:59-65` prints only bare command names at top level and only:

```text
Usage: friction <command> [options]
```

for command help.

The contract requires one-line purposes at top level and command syntax plus important rules.

### Required implementation

1. Add `src/cli/contract.ts` with small static presentation metadata per command:

   - purpose;
   - exact syntax lines;
   - option names with one-line meaning;
   - important default or safety notes.

2. Do not drive argument parsing from this metadata. It is help/schema presentation data, not a CLI framework.

3. Use it from `writeHelp` and `currentSchema` to reduce drift.

4. Important help must call out at least:

   - `add`: exactly one positional body or `--stdin`; stdin recommended for agents;
   - `list/stats/export`: current-vs-all default behavior;
   - `setup/publish/purge`: preview default and explicit `--apply`;
   - `publish`: current repository only;
   - `purge`: private events only, shared copies remain;
   - `schema`: always JSON.

5. Keep output concise and deterministic; no color dependency.

### Minimal test change

Extend `scripts/pack-smoke.mjs` to assert:

- top-level help includes a command purpose;
- `setup --help` includes `--apply` and “preview”;
- no exact full-output snapshot.

### Acceptance criteria

A human or agent can discover real syntax and safety defaults without opening the README.

---

## F-09 — Medium: `schema` is incomplete and partly misleading

### Evidence

`src/cli/schema.ts` has several contract gaps:

- opaque `mutation` strings instead of explicit read/appending/destructive/repository-writing annotations;
- one combined lifecycle field list that includes `verification` even for `reopened` events;
- no explicit public list/export record shape;
- environment inventory omits `CODEX_HOME` and `PATH`, both used by setup;
- byte limits are duplicated rather than fully canonical;
- command effects such as configuration writing and preview defaults are not machine-distinct.

### Required implementation

1. Reuse the lightweight command metadata from F-08.

2. Give each command explicit booleans or stable annotations:

   ```ts
   {
     readOnly: boolean;
     appendsPrivate: boolean;
     destructive: boolean;
     writesRepository: boolean;
     writesConfiguration: boolean;
     previewDefault: boolean;
   }
   ```

3. Describe observation, resolved, and reopened event shapes separately.

4. Describe the materialized internal record separately from the public list/export record.

5. Describe the published projection and state clearly that it is not canonical.

6. Import enums, limits, error registry, and exit-code constants from their owning modules rather than restating values.

7. Inventory every supported environment variable actually consulted:

   ```text
   FRICTION_HOME
   XDG_DATA_HOME
   HOME
   CODEX_HOME
   PATH
   ```

8. Keep schema hand-written and small. Do not add JSON Schema tooling or a generator framework.

### Minimal test change

Add compact assertions to package smoke or the existing capture contract test:

- schema has explicit effect annotations;
- reopened fields do not claim `verification`;
- `CODEX_HOME` appears in the environment list;
- body limit equals the canonical domain constant indirectly through output.

Do not snapshot the entire schema.

### Acceptance criteria

An unfamiliar agent can inspect `friction schema` and make safe decisions about reads, private appends, destructive actions, repository writes, configuration writes, limits, and record shapes.

---

## F-10 — Medium: `io_error` has the wrong message and retry policy

### Evidence

`src/cli/errors.ts:18-22` defines:

```text
The private event could not be stored.
retryable: true
```

The same code is used by export, publish, setup, purge, event loading, and doctor paths. The message is inaccurate outside capture, and automatic retry can duplicate capture observations or repeat unsafe assumptions.

### Required implementation

1. Change the stable message to a command-neutral form, for example:

   ```text
   An I/O operation failed.
   ```

2. Set generic `io_error.retryable` to `false` for the PoC.

3. Keep known safe retry/precondition cases in their specific codes. Do not add arbitrary exception text or path payloads.

4. If future measured data justifies a genuinely retryable lock/contention code, use reserved exit code 5 then; do not overload generic I/O now.

### Minimal test change

No dedicated new test is required. The schema assertion from F-09 can check the stable registry entry, or existing handled-error coverage can be extended by one assertion.

### Acceptance criteria

Every command receiving `io_error` gets a truthful, safe, command-neutral envelope.

---

## F-11 — Medium: child-process stdin can emit an unhandled `EPIPE`

### Evidence

Both:

- `test/support/process.ts:45`; and
- `scripts/pack-smoke.mjs:34`

always create a piped stdin and immediately call `child.stdin.end(...)` without an error listener. A child that exits before the parent finishes writing can emit `EPIPE` and fail the parent process independently of the behavior being tested.

This occurred during the review run and had to be handled before the 12 test cases could complete reliably.

### Required implementation

1. In both process helpers, select stdin mode based on whether input exists:

   - no input -> `stdio: ["ignore", "pipe", "pipe"]`;
   - input present -> `stdio: ["pipe", "pipe", "pipe"]`.

2. When stdin is piped, attach the error listener **before** calling `end`:

   - ignore only `EPIPE`, because it means the child already closed input;
   - reject every other stdin error.

3. Ensure child `error`, stdin error, and `close` settle the wrapper only once.

4. Keep the two helpers separate unless a shared helper materially reduces ownership; do not add a test-process framework.

### Minimal test change

No new automated test is necessary. Verification is:

- run the full suite three times under Node 24;
- run package smoke three times;
- confirm no `EPIPE`, unhandled rejection, or process warning caused by the helper.

### Acceptance criteria

Fast-exiting child commands cannot make tests or package smoke fail because the parent wrote to a closed stdin pipe.

---

# 4. Ordered implementation sequence for the fixing agent

Follow this order. Do not work on later cleanup before the release blockers are green.

## Phase A — establish the exact baseline

1. Use Node 24.
2. Run `npm ci` with the committed lockfile.
3. Run and record:

   ```sh
   npm run check:lines
   npm run typecheck
   npm test
   npm run build
   npm run pack:smoke
   ```

4. Do not change code merely to accommodate a Node 22 or registry-specific review limitation.
5. Confirm the baseline test count and maximum source/test/script line count.

## Phase B — close privacy and destructive-operation blockers

1. Implement F-01 repository discovery state and fail-closed read scoping.
2. Extend the existing privacy regression test.
3. Run that test file and manually reproduce default list/stats/export from an attribution-unavailable Git repository.
4. Implement F-05 canonical limits/runtime validation because purge and publication rely on honest event validation.
5. Extend the existing doctor test.
6. Implement F-04 conservative corrupt-store purge refusal.
7. Extend the existing export/purge test.
8. Run the focused privacy, doctor, lifecycle, export/purge, and publish tests.

## Phase C — correct setup ownership and precedence

1. Implement F-02 per-target roots and deterministic multi-root lock identity.
2. Implement F-03 Codex precedence preconditions.
3. Implement F-07 true preflight/staging cleanup using the new target roots.
4. Implement F-06 known managed asset digests.
5. Extend only the two existing setup tests unless one small unit test is demonstrably clearer.
6. Verify user Codex, repo Codex, user Claude, repo Claude, generic preview, apply, repeat, undo, manual conflict, custom `CODEX_HOME`, precedence race, and symlink escape through combined scenarios—not a matrix of separate tests.

## Phase D — finish the public contract and tooling reliability

1. Add the small command metadata owner for F-08/F-09.
2. Improve help.
3. Correct schema shapes, effects, environment inventory, and canonical limits.
4. Correct `io_error` for F-10.
5. Harden child-process stdin for F-11.
6. Extend package smoke with a few substring/field checks.

## Phase E — full verification and self-review

Run:

```sh
npm run check:lines
npm run typecheck
npm test
npm test
npm test
npm run build
npm run check
npm run pack:smoke
npm run pack:smoke
npm run pack:smoke
```

Then manually verify these consequential paths in isolated temporary homes/repositories:

1. Unsafe repository attribution cannot widen default reads to all.
2. Explicit `--repo all` still works.
3. Custom `CODEX_HOME` outside `$HOME` previews and applies correctly.
4. Creating a non-empty override after plan causes setup conflict and no target mutation.
5. A malformed event causes purge to refuse before deleting anything.
6. An overlong loaded event is skipped and reported by doctor.
7. A known prior managed asset upgrades; manually changed content conflicts.
8. Setup, publish, undo, and purge previews create no files or directories.
9. Help and schema communicate actual defaults and side effects.
10. The packed tarball includes only `dist`, `assets`, `skills`, and intended documentation.

Finally report:

- exact commands and results;
- Node/npm versions;
- tests total and repeated-run results;
- maximum code-file line count;
- which checks used real Git/files/processes;
- which package runners were unavailable;
- any unrelated baseline failure.

# 5. Test-budget instructions

Keep the suite proportional.

- Current total: 12 tests.
- Target after this pass: **12–16**.
- Do not exceed 18.
- Prefer extending existing acceptance scenarios:
  - privacy regression -> F-01;
  - setup tests -> F-02, F-03, F-06, F-07;
  - doctor -> F-05;
  - export/purge -> F-04;
  - package smoke -> F-08, F-09, F-11.
- Do not create a test for every byte-limited field, every command-help line, every flag order, every Git failure code, every setup asset, or every possible race.
- Do not add coverage thresholds, snapshots of full help/schema output, mocks of the event store, or a generalized fault-injection framework.

# 6. Architecture constraints for the fix pass

Preserve these boundaries:

- `domain`: types, enums, limits, validation; no filesystem/process access.
- `security`: pure screening only.
- `repository`: Git discovery and safe attribution state.
- `storage`: event directories, loading, and immutable writes.
- `lifecycle`: folding, resolve/reopen, and purge policy.
- `views`: filtering and rendering.
- `setup`: setup-specific roots, preconditions, staging, and assets.
- `publish`: projection-specific validation and mutation.
- `cli`: parsing, command metadata, envelopes, help, and schema.
- `platform`: narrow filesystem/Git/process primitives.

Continue enforcing 300 physical lines for every source, test, and script file. Split only by real responsibility. In particular:

- use `domain/limits.ts` and, if needed, `domain/event-validation.ts` rather than overgrowing `events.ts`;
- use a setup precondition module if `plan.ts` or `apply.ts` approaches 250 lines;
- use one small CLI contract metadata module rather than duplicating help and schema;
- do not create `utils.ts`, `helpers.ts`, `setup-part-2.ts`, or a generic mutation engine.

# 7. Explicit non-goals for this correction pass

Do not add:

- SQLite, JSONL canonical storage, indexes, or caches;
- runtime dependencies;
- a CLI or schema framework;
- hooks or passive transcript mining;
- automatic model calls or review;
- MCP or harness-native tools;
- cloud sync, accounts, teams, telemetry, dashboards, or daemons;
- automatic issue submission;
- bulk purge;
- prefix observation IDs;
- semantic clustering in the CLI;
- broad rollback/backup infrastructure;
- exhaustive tests for hypothetical conditions.

The correct outcome is the existing small product with its safety and contract gaps closed—not a larger product.
