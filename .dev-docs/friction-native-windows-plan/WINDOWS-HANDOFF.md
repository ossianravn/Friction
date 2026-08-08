# Native Windows handoff

- **Updated:** 2026-08-08 15:45 Europe/Copenhagen
- **Branch:** `main`
- **Current code commit:** `e7d205890941f075c565d7454b0a9b4eb7afa7af`
- **Milestone:** W8 native Windows dogfood complete

## Outcome

W7 and W8 are complete. The clean GitHub Actions matrix passed on:

- `ubuntu-latest`;
- `macos-latest`;
- pinned `windows-2025`;

All three commands passed on every lane:

```text
npm ci
npm run check
npm run pack:smoke
```

Run evidence:

```text
https://github.com/ossianravn/Friction/actions/runs/31254855247
ubuntu-latest: success in 32s
macos-latest: success in 22s
windows-2025: success in 25m38s
```

The Windows 11 x64/local-NTFS support gate is complete. Windows ARM64 and private UNC
storage remain unclaimed.

## W8 native Windows progress

The documented pass uses a clean native clone, two isolated Git repositories, an
isolated user profile, and an isolated Friction store. No live Codex, Claude, or
Friction user data was mutated.

Environment evidence:

- Windows 11 Pro x64, version 25H2, build 26200, on a healthy fixed NTFS volume;
- Microsoft Defender antivirus and real-time protection enabled;
- Node 24.14.0 with npm 10.9.2 for Friction; the machine PATH otherwise exposes
  Node 22.14.0;
- Git for Windows 2.50.1 and Git Bash 5.2.37;
- Windows PowerShell 5.1.26100.8875 and PowerShell 7.6.3;
- native Codex CLI 0.124.0 and authenticated native Claude Code 2.1.226.

Passed local evidence:

1. A clean clone at commit `e7d2058` passed `npm ci`, build, `npm pack`, isolated
   global install, `friction.cmd --version`, and PATH discovery. The packed artifact
   contained the built CLI and both harness skills.
2. Codex and Claude setup previews performed zero writes. Apply, no-op reapply, undo
   preview, and undo apply passed. Generic setup emitted both PowerShell and Git Bash
   stdin snippets.
3. Capture passed from Windows PowerShell 5.1, PowerShell 7 in a repository
   subdirectory, the native Codex task in a second repository, and Git Bash with
   `source=claude-code`.
4. A synthetic Unicode probe preserved non-ASCII Latin text, CJK, emoji, and an arrow.
   Its synthetic secret canary was absent from canonical event bytes and command
   output. The probe and its lifecycle events were purged after verification.
5. Final repository-scoped list returned the expected 4/1 split; all-scope stats
   returned five genuine records across two repositories. A detached-HEAD read in the
   second repository retained correct attribution.
6. Review, resolve, reopen, JSONL export, publish preview/apply/no-op reapply, purge
   preview/apply, and doctor all passed. Publish preview left the repository unchanged;
   purge preview preserved all event hashes.
7. Publish apply created only the sanitized `.friction/observations.jsonl` projection.
   The private export and repository projection omitted the synthetic canary and
   absolute test root. Targeted purge left both prior copies unchanged, as documented.
8. The canonical home, version root, events, temporary, and setup-lock directories all
   passed the exact protected current-user + LocalSystem ACL policy. All five remaining
   event files passed the file allowlist with zero unexpected or missing rules.
9. Final doctor after Claude logout, setup undo, and profile cleanup returned zero
   errors and only the expected setup warnings.
10. Authenticated native Claude Code 2.1.226 ran through Git Bash from the isolated
    public clone, followed the installed capture guidance, invoked only the approved
    Bash capture, and returned `W8_CLAUDE_NATIVE_OK fr_972995b86e0c488381e07644419307be`.
    It reported no permission denials or web requests, made no new repository edit,
    completed in 18.4 seconds, and reported a total cost of about USD 0.1026.

The dogfood review covered the four observations present at that point and redacted
their bodies from this report. The final live Claude capture later brought the corpus
to five. The review's highest-priority record was external Codex command-yield false
evidence (`fr_1ccd19be20604a92bdc5715df51b6afc`), not a Friction correctness
defect. The runner-up was verified setup latency
(`fr_667be872ed65453cb9ce84fdabdf183f`): setup operations measured 59 to 97 seconds
because the safe Windows path repeatedly crosses the PowerShell ACL bridge. This is
visible friction and the same performance risk already documented below, but it did
not break correctness, cleanup, or privacy.

No Friction source change was required during W8. No high-severity native Windows
finding is open.

## W8 completion

The authenticated native Claude pass completed the last release gate. The isolated
account was logged out afterward, Claude setup was undone, and the isolated user-home
and local-app-data trees were removed so no test credential or session remained.

A genuine second-account read attempt was unavailable: three other enabled local
accounts exist, but no credentials or impersonation token were available. Exact ACL
verification against all canonical directories and event files is the available local
evidence; do not describe it as a real second-user login test. The acceptance contract
requires that attempt only when available, so this does not leave W8 open.

## Current state

The complete native-Windows implementation is committed and pushed to `main`.
The final hosted matrix for `e7d2058` is green:

```text
https://github.com/ossianravn/Friction/actions/runs/31254855247
```

The immediately preceding Windows run reached 14/15 passing tests. Every production
scenario passed, including capture, eight-process capture, lifecycle, export/purge,
publish, setup, ACL/reparse security, and rollback. Its only failure was the doctor
test fixture: it hand-wrote malformed event files without applying the Windows ACL
policy, so doctor correctly stopped at `safety_failure` instead of reporting the
synthetic JSON finding. Commit `e7d2058` secures those fixture files, and the focused
native Windows doctor test passes.

## Hosted-only findings already fixed

1. macOS temporary paths may traverse `/var -> /private/var`.
   Setup/output path checks now canonicalize the nearest existing POSIX ancestor.
2. Hosted Windows PowerShell module loading could hit 15-second certificate lookup
   behavior. The production ACL bridge now uses direct .NET ACL APIs instead of
   `Get-Acl` and `Set-Acl`.
3. Windows checkout converted managed assets to CRLF and invalidated known safety
   digests. `.gitattributes` now pins repository text to LF.
4. GitHub's Windows volume preserves inherited file ACE metadata differently from the
   Windows 11 fixture. File verification follows the written effective-allowlist
   contract, while directory inheritance and propagation remain exact.
5. More importantly, newly inherited file ACLs on the hosted volume were not exact
   enough. Friction now applies and verifies the current-user + LocalSystem DACL while
   event temp files and setup locks are still empty, before sensitive bytes or lock
   state are written. Existing files remain verification-only; reads never repair.
6. The doctor corruption fixtures now receive the private file ACL before doctor reads
   them.

Temporary CI probes used to isolate these facts have been removed from the final
workflow. Diagnostic commits remain in history, but the checked-in workflow contains
only the required matrix steps and Windows home isolation.

## Verification evidence

Local Linux at the current behavior:

```text
npm run check
# 14 passed, 1 native-Windows skip; typecheck, line check, and build passed

npm run pack:smoke
# passed
```

Focused real Windows 11 x64 with Node 24:

```text
node --import tsx --test test/windows/security.test.ts
# 1 passed

node --import tsx --test test/acceptance/doctor.test.ts
# 1 passed
```

These focused runs used real Windows PowerShell 5.1, NTFS ACL mutation and inspection,
junction behavior, hard-link installation, atomic replacement, setup preview, doctor,
and subprocess CLI execution. They were not mocked or simulated.

The preceding hosted Windows production-path run was:

```text
https://github.com/ossianravn/Friction/actions/runs/31253911529
# npm ci passed
# npm run check: 14 passed, 1 fixture failure
# npm run pack:smoke did not run because check failed
```

## What to do on native Windows

Use an isolated clone and isolated user-local paths. Do not point tests or setup at live
Codex, Claude, or Friction data.

From PowerShell 7 in a clean clone:

```powershell
npm ci
npm run check
npm run pack:smoke
```

Record the exact Node, npm, Windows, filesystem, PowerShell 5.1, and PowerShell 7
versions. If a command fails, inspect the first failing production boundary before
editing. Preserve these invariants:

- no private bytes before ACL verification;
- exact directory DACL: current user and LocalSystem only, protected inheritance;
- file effective allowlist: current user and LocalSystem only, FullControl, no denies;
- no path, SID, SDDL, body, or credential leakage in normal output;
- setup/publish/purge previews perform zero writes;
- no non-atomic or permissive fallback;
- zero runtime dependencies;
- 300 physical lines maximum per code file.

## Remaining risk

The hosted Windows suite remains close to its timeout because each real ACL/reparse
boundary starts the built-in Windows PowerShell 5.1 process. The successful Windows
job took 25m38s against a 30-minute timeout: `npm run check` took 23m45s and packaged
smoke took 1m28s. Do not create headroom by weakening checks or skipping Windows
acceptance. If runtime regresses, first measure which repeated process boundaries
dominate and reduce safe, duplicated inspections at the owning operation while
preserving pre-write and post-install verification.

## W7 completion

W7 completed on commit `e7d205890941f075c565d7454b0a9b4eb7afa7af`. Run
`31254855247` shows all three lanes green, and each lane independently passed `npm ci`,
`npm run check`, and `npm run pack:smoke`.
