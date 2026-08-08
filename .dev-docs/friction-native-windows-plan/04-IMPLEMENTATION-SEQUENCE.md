# 04 — Ordered implementation sequence for Codex

Do not skip ahead to README claims or CI labels. Each milestone has an entry condition, exact responsibilities, and an exit gate.

## W0 — Stabilize existing release blockers

### Implement

1. Introduce distinct repository discovery states: not-repository, repository, and repository-unavailable.
2. Fail closed for implicit/current reads when attribution is unavailable; allow explicit `--repo all`.
3. Add canonical event limits and validate loaded events semantically.
4. Make purge refuse any store with findings before preview or apply.
5. Model setup roots per target so external `CODEX_HOME` is valid.
6. Snapshot and recheck Codex precedence.
7. Add known managed-asset digests for safe setup upgrades.
8. Refactor setup staging cleanup so failed work leaves no created directories.
9. Improve help/schema ownership and generic I/O messaging.
10. Fix process helper `EPIPE` handling.

### Exit gate

- The correction-plan tests pass on the existing supported platforms.
- No blocker is marked deferred because Windows work is beginning.

## W1 — Establish platform contracts

### Implement

1. Add `runtime-platform.ts` with an exhaustive `darwin | linux | win32` model.
2. Add case-insensitive Windows environment lookup and normalized child environments.
3. Add the Windows support constants and capability types.
4. Add the Windows path validator and local-home resolution.
5. Route storage path selection through the platform boundary.
6. Add PATHEXT-aware command discovery without changing setup behavior yet.

### Exit gate

- `resolveFrictionPaths()` succeeds on win32 fixtures with `%LOCALAPPDATA%`.
- Invalid Windows homes fail before any write.
- POSIX path and executable tests remain green.

## W2 — Implement the Windows privacy boundary

### Implement

1. Add the static PowerShell runner.
2. Add ACL mutation and inspection scripts.
3. Add typed ACL verification.
4. Create and secure the Friction root before child/private writes.
5. Verify temporary and installed event file ACLs.
6. Add Windows ACL doctor checks.
7. Make setup lock initialization use the same secure root path.

### Exit gate

- A native Windows capture cannot persist bytes unless the exact ACL policy passes.
- Broadened, inherited, inaccessible, or unverifiable ACLs fail closed.
- Preview commands still make zero writes.

## W3 — Replace POSIX-only file assumptions

### Implement

1. Add reparse inspection and safe component walking.
2. Replace direct `O_NOFOLLOW` calls with platform safe-read helpers.
3. Centralize exclusive file installation.
4. Centralize atomic replacement with bounded Windows contention retries.
5. Make setup, export, publish, and purge use the shared helpers.
6. Add Windows capability probes for `wx`, hard links, rename, and locks.

### Exit gate

- Local NTFS passes all required primitives.
- Junctions, device paths, unsafe names, path escapes, and changed preimages fail closed.
- No non-atomic fallback exists.

## W4 — Complete native CLI and Git behavior

### Implement

1. Use the normalized child-process environment in Git.
2. Set `windowsHide` and preserve bounded process behavior.
3. Verify Git for Windows canonical path output and CRLF handling.
4. Make doctor find `friction.cmd` through PATHEXT.
5. Make package smoke execute the installed command shim.
6. Ensure JSON stdout remains one object and stderr remains contract-safe.

### Exit gate

- Packaged `friction --version`, `add`, `list`, and `doctor` work by command name on Windows.
- Repository discovery distinguishes all three states correctly.

## W5 — Implement Windows harness setup

### Implement

1. Split POSIX and PowerShell capture templates.
2. Install PowerShell guidance for native Codex.
3. Install Git Bash guidance for native Claude Code.
4. Print both labeled variants for generic Windows setup.
5. Preserve CRLF/LF and unrelated bytes.
6. Verify custom `CODEX_HOME`, override precedence, apply/reapply/undo, asset upgrades, and cleanup.
7. Keep every preview literally zero-write.

### Exit gate

- Isolated native Windows Codex and Claude fixture scenarios pass.
- No setup operation edits profiles or guesses an unsupported shell.

## W6 — Finish the public contract

### Implement

1. Update command metadata and help with Windows defaults and side effects.
2. Add win32 support, `LOCALAPPDATA`, `CODEX_HOME`, PATH/PATHEXT, ACL policy, and capability data to `schema`.
3. Add safe Windows doctor findings.
4. Update README and current PRD clauses.
5. Remove misleading WSL-only wording.

### Exit gate

- An unfamiliar agent can discover the Windows contract from `friction schema` and command help.
- Documentation makes no unsupported ARM64 or UNC claim.

## W7 — Add mandatory native CI

### Implement

1. Replace the single Ubuntu job with an OS matrix.
2. Include `ubuntu-latest`, `macos-latest`, and pinned `windows-2025`.
3. Use Node 24 on every lane.
4. Run `npm ci`, `npm run check`, and `npm run pack:smoke`.
5. Add Windows-only PowerShell 5.1, PowerShell 7, ACL, junction, and npm-shim acceptance steps.
6. Use isolated `HOME`, `USERPROFILE`, `LOCALAPPDATA`, `FRICTION_HOME`, and `CODEX_HOME` values.

### Exit gate

- All matrix lanes pass from a clean checkout.
- No test touches live user configuration or repository data.

## W8 — Native Windows 11 dogfood

### Execute

1. Install the packed artifact on Windows 11 x64.
2. Run capture from PowerShell 5.1, PowerShell 7, Codex, and Claude Code/Git Bash.
3. Use at least two Git repositories and one subdirectory.
4. Exercise list, stats, review, resolve, reopen, export, publish preview/apply, purge preview/apply, setup preview/apply/reapply/undo, and doctor.
5. Inspect ACLs and attempt read access from a second local test account when available.
6. Record any genuine product friction through Friction itself.
7. Fix only reproducible release blockers before making the support claim.

### Exit gate

- Every release criterion in `05-TEST-CI-ACCEPTANCE.md` passes.

## Parallel work rule

After W1 establishes shared types, independent work may proceed only across non-overlapping owners:

- ACL/store boundary;
- path/filesystem primitives;
- CLI/Git/process behavior;
- setup assets and adapters;
- tests/CI/documentation.

One integrator owns shared platform contracts, command metadata, package scripts, and the workflow. Do not create duplicate helpers or merge competing platform models.
