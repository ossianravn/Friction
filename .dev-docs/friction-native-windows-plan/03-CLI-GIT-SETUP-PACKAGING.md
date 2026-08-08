# 03 — Windows CLI, Git, setup, and packaging plan

## 1. PATH and executable discovery

The current exact-name plus `X_OK` check is not valid on Windows. `X_OK` behaves like existence checking there, and npm exposes package binaries through Windows command shims such as `friction.cmd`.

Implement platform-aware discovery:

### POSIX

- keep exact filename search;
- require a regular file and executable access.

### Windows

1. Read `PATH` case-insensitively.
2. Read `PATHEXT` case-insensitively.
3. If the requested name has no extension, try PATHEXT entries in order.
4. Use a conservative fallback of `.COM;.EXE;.BAT;.CMD` only when PATHEXT is absent.
5. Search each PATH directory in order.
6. Require a regular file and reject a reparse point.
7. Discovery returns the resolved command kind; it does not execute the candidate.

A real Windows package smoke must prove that `friction.cmd` is found.

## 2. Invoking command shims in tests

Node cannot directly execute `.cmd` files without a command shell.

For package smoke and acceptance only:

- invoke the installed command through PowerShell, or
- spawn `%ComSpec%` with `/d /s /c` and a safely quoted fixed command.

Never place an observation body, repository path, or other untrusted value in the shell command string. Pass authored content through stdin.

Production Friction should not need to spawn its own npm shim.

## 3. Child-process environment

Add one environment-normalization helper:

- treat keys case-insensitively on Windows;
- emit exactly one `Path`/`PATH` key;
- avoid duplicate casing variants such as `PATH` and `Path`;
- add fixed Git variables without leaking secrets;
- set `windowsHide: true` on Windows child processes;
- retain bounded output, timeout, and single-settlement behavior;
- use ignored stdin when no input exists, avoiding the known `EPIPE` race.

Apply it to Git, the Windows security bridge, package-smoke helpers, and any setup capability subprocess.

## 4. Git for Windows

Keep Git as the repository authority. Do not parse `.git` internals or localized stderr.

Use status and stdout from commands such as:

```text
git rev-parse --path-format=absolute --show-toplevel
git rev-parse --path-format=absolute --git-common-dir
git rev-parse --is-inside-work-tree
git rev-parse --verify HEAD
git remote get-url origin
```

Rules:

- use canonical absolute output where supported;
- normalize CRLF from stdout;
- do not depend on `LC_ALL=C` for correctness on Windows;
- do not expose stderr in public errors;
- distinguish not-a-repository, Git unavailable, timeout/overflow, and unsafe attribution;
- preserve the fail-closed default-scope fix from the repository review;
- test a normal repo, a subdirectory, linked worktree if Git supports it, detached HEAD, and no remote without creating an exhaustive matrix.

## 5. Capture assets

Split the single POSIX asset into explicit templates:

```text
assets/instructions/capture-posix.md
assets/instructions/capture-powershell.md
```

Keep shared prose in one canonical source or a small renderer so the definitions of friction do not drift.

PowerShell template requirements:

- explicit no-BOM UTF-8 `$OutputEncoding`;
- body through stdin;
- correct adapter source;
- no profile edit;
- no `Invoke-Expression`;
- no package runner on every capture.

POSIX template remains the Git Bash, macOS, Linux, and WSL form.

## 6. Codex setup on Windows

- User scope resolves `CODEX_HOME` case-insensitively, defaulting to the documented Codex home.
- Each target has its own canonical ownership root; do not assume `CODEX_HOME` is inside `HOME`.
- Install the PowerShell capture template for native Windows.
- Preserve existing newline style in managed files, including CRLF.
- Snapshot both ordinary and override instruction candidates.
- Recompute active-file precedence under the setup lock before any mutation and again before commit.
- A changed precedence decision is a zero-write setup conflict.
- Preview must not create the Friction store, ACLs, directories, locks, or timestamps.

## 7. Claude Code setup on Windows

Anthropic documents native Windows through Git Bash. Therefore:

- install the POSIX/Git Bash capture template for the native Claude adapter;
- preserve `.claude/rules` and skill ownership boundaries;
- use Windows-native paths for file placement while keeping shell text POSIX;
- verify the packaged skill files are usable with CRLF or LF;
- do not claim PowerShell-native Claude shell behavior unless Anthropic's active configuration proves it.

Generic Windows setup prints both PowerShell and Git Bash snippets and writes nothing.

## 8. Safe setup upgrade behavior

Implement the repository-review correction while adding Windows:

- stable asset ID per owned file;
- current digest and a small allowlist of prior shipped digests;
- missing → create;
- current → no-op;
- known previous → update;
- unknown → conflict;
- undo removes only recognized managed versions.

Refactor apply into preflight, directory creation, staging, recheck, commit, and cleanup phases. Remove only directories created by the failed invocation and only when empty.

## 9. npm package smoke on Windows

The Windows smoke must:

1. build;
2. run `npm pack` into a temporary directory;
3. inspect the tarball allowlist;
4. install it into an isolated npm prefix;
5. prepend that prefix's Windows bin location to PATH;
6. invoke `friction --version` by command name through PowerShell;
7. capture a Unicode observation through stdin;
8. list it in a separate process;
9. run `friction doctor --json`;
10. verify packaged instruction and skill assets;
11. remove the temporary prefix and store.

Do not test by calling `node dist/bin/friction.js`; that would miss the `.cmd` contract.

## 10. Documentation

Add native Windows examples for:

- build and local tarball installation;
- PowerShell capture;
- Git Bash capture;
- setup preview/apply/undo;
- `FRICTION_HOME` and `%LOCALAPPDATA%`;
- Git for Windows requirement;
- local-NTFS baseline and unsupported private UNC store;
- WSL as the Linux path, not the native path.

Do not include a human-day estimate.
