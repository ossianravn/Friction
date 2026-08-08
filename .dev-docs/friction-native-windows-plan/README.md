# Friction native Windows support plan

**Status:** W8 complete; native Windows 11 x64 support validated

**Audience:** Codex implementing native Windows support in the existing TypeScript repository

**Planning unit:** dependency gates and verified outcomes, not human-day estimates

## Implementation progress

Keep this ledger current as each milestone is verified. A milestone is complete only
when its documented exit gate has passed; implementation without native evidence is
not completion.

| Milestone | State | Current evidence or next gate |
|---|---|---|
| W0 — existing release blockers | Complete | Node 24.14.0; `npm run check` passed 12/12; `npm run pack:smoke` passed. |
| W1 — platform contracts | Complete | Win32 path fixtures and invalid-home gates pass; POSIX suite remains green. |
| W2 — Windows privacy boundary | Complete | Native Windows 11/Node 24 ACL test passed; Linux gate passes 14/15 with that test skipped. |
| W3 — Windows filesystem safety | Complete | Native NTFS junction, capability, safe-read, and changed-preimage gates pass. |
| W4 — CLI and Git | Complete | Native packaged `friction.cmd` passed version, Unicode add/list, and doctor; Git for Windows passed all three discovery states. |
| W5 — harness setup | Complete | Native Codex PowerShell and Claude Git Bash apply/reapply/undo fixtures passed with CRLF, precedence, and junction gates. |
| W6 — public contract | Complete | Help, schema, doctor, README, assets, and current PRDs expose the under-validation Windows contract. |
| W7 — mandatory native CI | Complete | Hosted run [`31254855247`](https://github.com/ossianravn/Friction/actions/runs/31254855247) passed on commit `e7d2058`: Ubuntu in 32s, macOS in 22s, and `windows-2025` in 25m38s. Every lane passed `npm ci`, `npm run check`, and `npm run pack:smoke`. |
| W8 — Windows 11 dogfood | Complete | Pack/install, PowerShell 5.1/7, Git Bash, native Codex and authenticated native Claude Code, two-repository and detached-HEAD reads, lifecycle, review, export, publish, purge, doctor, ACL inspection, setup lifecycle, logout, and isolated-profile cleanup passed on Windows 11 x64. |

**Current gate:** W8 is complete. Clean `ubuntu-latest`, `macos-latest`, and pinned
`windows-2025` lanes passed the Node 24 check/package smoke matrix on commit
`e7d2058`. Windows 11 x64 dogfood then passed in native Codex and authenticated native
Claude Code through Git Bash. No high-severity Windows finding remains, so the narrow
Windows 11 x64/local-NTFS support claim is now enabled.

**Latest review-fix evidence:** POSIX export now canonicalizes the nearest existing
parent before safe component inspection, including the macOS `/var` symlink shape.
Raw Windows drive-relative path inputs are rejected before resolution. The shared
Windows component inspector accepts validated UNC repository/export roots while the
private-home validator continues to reject UNC. Focused Linux tests passed 2/2 and
the affected native Windows 11 tests passed 3/3 with isolated homes and real ACLs.

## Directive

Native Windows is no longer deferred. The existing clauses that limit Windows to WSL are superseded by this plan. WSL remains supported as Linux behavior, but it is not evidence that native Windows works.

Do not estimate this work in hours or days. Execute the milestones in order and continue until every required gate passes or a concrete external blocker is documented with reproduction evidence.

## Read first

1. `00-SUPPORT-CONTRACT.md`
2. `01-SECURITY-ACL-STORE.md`
3. `02-PATHS-FILESYSTEM-ATOMICITY.md`
4. `03-CLI-GIT-SETUP-PACKAGING.md`
5. `04-IMPLEMENTATION-SEQUENCE.md`
6. `05-TEST-CI-ACCEPTANCE.md`
7. `06-CODE-MAP-AND-TASKS.md`
8. `07-PRD-AND-DOC-CHANGES.md`
9. `SOURCES.md`

## Product outcome

A user on supported native Windows must be able to:

- install the npm package and invoke `friction` through npm's Windows command shim;
- capture Unicode observations from PowerShell and from Git Bash;
- keep the canonical store under a private Windows ACL;
- list, review, resolve, reopen, export, publish, purge, and run doctor safely;
- use Codex and Claude Code setup without POSIX-only instructions;
- receive the same privacy, preview, lifecycle, and projection guarantees as macOS and Linux.

## Supported baseline

The first native claim is deliberately narrow:

- Windows 11 x64 for user-facing support;
- Windows Server 2025 x64 for the mandatory CI lane;
- Node.js 24 and npm;
- PowerShell 7 and Windows PowerShell 5.1 for capture validation;
- Git for Windows for repository-aware behavior and native Claude Code;
- native Codex on Windows;
- native Claude Code through its documented Git Bash path.

Do not claim Windows ARM64 until a real ARM64 runner or machine passes the complete acceptance set. Keep implementation architecture-neutral so ARM64 does not require a redesign.

## Non-negotiable engineering constraints

- Keep the current private, personal, local-first product model.
- Keep the canonical one-file-per-event store.
- Keep zero runtime npm dependencies.
- Keep Node.js 24, strict TypeScript, ESM, and npm.
- Keep every source, test, and script file at or below 300 physical lines.
- Split by real ownership, never by mechanical `part-1` files or compressed formatting.
- Keep the total automated test count in the 12–18 target range; never exceed 24.
- Do not weaken privacy on Windows by ignoring ACLs or reparse points.
- Do not add SQLite, a native addon, a daemon, cloud sync, hooks, transcript mining, MCP, telemetry, teams, or an installer framework.
- Do not use shell interpolation with observation bodies, paths, or other untrusted data.
- Preserve preview-only behavior for setup, publish, purge, and undo.

## Existing defects that remain release blockers

Windows support must not be layered over the unresolved repository-review blockers. Milestone W0 incorporates the required corrections that affect native Windows:

- fail closed when current-repository attribution is unavailable;
- validate loaded events against canonical limits;
- support custom `CODEX_HOME` outside the user's home safely;
- recheck Codex instruction precedence at apply time;
- make purge refuse malformed stores;
- make owned setup assets safely upgradeable;
- leave no directories after pre-commit setup failure;
- make help and schema accurate enough for agents;
- fix generic I/O messaging and child-process `EPIPE` handling.

Do not mark Windows complete while any of those release blockers remains open.

## Definition of done

Native Windows support is done only when:

1. the full check and package smoke run on `windows-2025` with Node 24;
2. the ACL gate proves private storage is restricted to the current user and LocalSystem;
3. Unicode capture round-trips from PowerShell 5.1, PowerShell 7, and Git Bash;
4. junction, symlink, device-path, path-escape, and unsafe-store cases fail closed;
5. packaged `friction.cmd` is discovered and used through `PATH`;
6. setup preview/apply/reapply/undo passes in isolated Codex and Claude fixtures;
7. concurrent first-use capture and lifecycle operations preserve intact events;
8. export, publish, purge, and doctor pass native Windows acceptance;
9. a Windows 11 x64 dogfood pass succeeds in native Codex and native Claude Code;
10. documentation states the exact supported Windows baseline without overstating ARM64 or network-share support.

The implementation order and concrete file ownership are specified in the remaining documents.
