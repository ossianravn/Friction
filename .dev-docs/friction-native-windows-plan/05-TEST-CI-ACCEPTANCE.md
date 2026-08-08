# 05 — Windows tests, CI, and release acceptance

## 1. Test philosophy

Use real native Windows boundaries. Do not “test Windows” by mocking `process.platform` on Linux for behavior that depends on ACLs, NTFS, junctions, PowerShell, Git for Windows, PATHEXT, or npm `.cmd` shims.

Pure path-policy transformations may be table-tested on any platform. Every operating-system guarantee requires the `windows-2025` lane.

Keep the suite proportional:

- current suite: 12 tests;
- target after Windows work: 14–18 tests;
- hard ceiling: 24;
- prefer extending existing scenarios;
- no coverage target;
- no snapshot of complete help/schema output;
- no test for every flag order, reserved filename, Git exit code, or ACL permutation.

## 2. Existing tests to extend

### Capture/privacy test

Add conditional native-Windows assertions for:

- default LocalAppData store;
- Unicode body round-trip;
- root and event ACL policy;
- broadened ACL refusal;
- no body in success output.

### Repository/privacy test

Add:

- drive-letter case variation;
- Windows subdirectory repository discovery;
- repository-unavailable fail-closed scope;
- explicit `--repo all` success;
- Git for Windows stdout normalization.

### Setup acceptance tests

Add:

- external `CODEX_HOME` on another directory root;
- PowerShell Codex template;
- Git Bash Claude template;
- CRLF preservation;
- precedence-change zero-write conflict;
- known asset upgrade and manual-edit conflict;
- no directory residue after staging failure.

### Export/publish/purge test

Add:

- Windows reserved/device output rejection;
- junctioned parent rejection;
- changed-preimage conflict;
- malformed-store purge refusal.

### Doctor test

Add structural assertions for:

- platform and resolved Windows store;
- ACL status;
- atomic capability status;
- PATHEXT command discovery;
- no raw SID, SDDL, body, or private path content.

### Concurrency test

Run the existing multi-process capture case on Windows. Use at least eight simultaneous processes; do not create a large stress benchmark.

## 3. At most two new Windows-specific test files

### `test/windows/security.test.ts`

One integrated scenario should cover:

- ACL creation and exact inspection;
- broad ACL refusal;
- junction/reparse rejection;
- exclusive create, hard-link, rename-replace, and lock capability probes.

### `test/windows/cli-package.test.ts`

One integrated scenario should cover:

- isolated npm tarball install;
- `friction.cmd` PATH discovery;
- PowerShell 5.1 Unicode stdin;
- PowerShell 7 Unicode stdin;
- separate-process list/doctor;
- packaged asset presence.

Skip these files outside win32 through an explicit platform guard. Do not simulate them.

## 4. CI workflow

Use one matrix job:

```yaml
strategy:
  fail-fast: false
  matrix:
    os: [ubuntu-latest, macos-latest, windows-2025]
runs-on: ${{ matrix.os }}
```

Use current stable major actions and Node 24:

```yaml
- uses: actions/checkout@v6
- uses: actions/setup-node@v6
  with:
    node-version: 24
    cache: npm
- run: npm ci
- run: npm run check
- run: npm run pack:smoke
```

Use `shell: pwsh` for Windows-only setup steps and ordinary platform defaults elsewhere.

## 5. CI isolation

On the Windows lane, create one job-local root and set:

- `USERPROFILE`;
- `HOME`;
- `LOCALAPPDATA`;
- `FRICTION_HOME`;
- `CODEX_HOME`;
- npm prefix/path values used by package smoke.

Do not point any test at the runner's real profile configuration. Preview tests must compare fixture trees byte-for-byte and confirm that the configured Friction home does not exist afterward.

## 6. Required Windows assertions

### Storage and privacy

- `%LOCALAPPDATA%\friction` selected when no override exists.
- Exact ACL policy passes.
- Private bytes are absent before ACL verification.
- Store drift prevents capture and purge.
- Event and lock files are regular, non-reparse files.

### Paths and files

- `C:relative` rejected.
- one representative reserved name rejected.
- one device path rejected.
- one junction escape rejected.
- case variation stays inside the intended root.
- hard-link and rename primitives pass on the selected local volume.

### CLI and encoding

- `friction.cmd` discovered through PATHEXT.
- a body containing non-ASCII Latin text, CJK, emoji, and an arrow round-trips exactly after redaction rules.
- success remains body-free.
- JSON output is parseable and contains no ANSI/prose.

### Git and setup

- normal repository and subdirectory attribution work with Git for Windows.
- unavailable attribution never widens implicit scope.
- Codex PowerShell and Claude Git Bash templates are correct.
- CRLF is preserved.
- apply/reapply/undo is idempotent and scoped.

## 7. Manual Windows 11 x64 acceptance

CI on Windows Server is necessary but not sufficient for desktop harness claims. Before release, run one documented Windows 11 x64 acceptance pass:

1. clean Node 24 installation;
2. current Git for Windows;
3. native Codex application or CLI;
4. native Claude Code through Git Bash;
5. packed Friction tarball installed through npm;
6. two repositories, including one worktree or detached-HEAD case if practical;
7. all core commands and setup lifecycle;
8. second-account private-read attempt when available;
9. antivirus/indexer running normally to exercise realistic file contention;
10. exact command transcript and pass/fail notes, with observation bodies redacted from the report.

## 8. Release gate

Do not update README to an unconditional native-Windows support claim until all are true:

- Linux, macOS, and Windows CI green from a clean checkout;
- Windows package smoke invokes the npm shim;
- PowerShell 5.1, PowerShell 7, and Git Bash capture pass;
- ACL and reparse gates pass;
- concurrency passes;
- setup lifecycle passes;
- publish/export/purge pass;
- Windows 11 native Codex and Claude dogfood passes;
- no high-severity unresolved Windows finding remains.

ARM64 remains unclaimed until the same set runs on a real ARM64 environment.
