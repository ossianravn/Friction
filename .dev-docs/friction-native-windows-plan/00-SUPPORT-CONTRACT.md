# 00 — Native Windows support contract

## 1. Scope change

Native Windows is part of the current PoC. Remove or amend every earlier statement that says native Windows is deferred or that WSL is the only Windows path.

WSL remains a Linux environment. Its success does not substitute for native `process.platform === "win32"` execution, Windows ACLs, npm `.cmd` shims, PowerShell, NTFS behavior, or native harness setup.

## 2. Supported environments

### Required user-facing support

- Windows 11 x64.
- Node.js 24.
- npm global or tarball installation.
- PowerShell 7.
- Windows PowerShell 5.1 for the documented UTF-8 capture form.
- Git Bash when used by native Claude Code.
- Git for Windows for repository-aware commands.

### Required CI support

- GitHub Actions `windows-2025` x64.
- Node.js 24 installed with `actions/setup-node`.
- Real NTFS, ACL, PowerShell, Git, child-process, and npm-shim behavior.

### Explicitly not claimed in this milestone

- Windows ARM64, until the full suite passes on a real ARM64 runner or device.
- Windows 10 as a product support promise.
- Canonical private storage on UNC paths.
- Guaranteed behavior on FAT, exFAT, WebDAV, SMB, or third-party synchronized filesystems.
- Windows Store packaging, MSI, winget, Chocolatey, Scoop, or automatic PATH mutation.
- Native addons or Win32 FFI.

## 3. Product invariants on Windows

The following invariants must remain identical to macOS and Linux:

1. The private user store is the only canonical store.
2. Capture never writes into the current repository.
3. Redaction runs before private persistence or public projection.
4. Capture failure never blocks the primary coding task when agents follow installed guidance.
5. Setup, publish, purge, and undo are preview-only without `--apply`.
6. Repository projection is sanitized, explicit, and noncanonical.
7. Resolution occurs only after a verified fix; reopening represents recurrence.
8. Stored observation bodies never appear in success receipts, doctor output, or setup diagnostics.
9. Unsafe paths, unverified ACLs, malformed stores, and changed preconditions fail closed.
10. No automatic transcript review, model call, telemetry, background watcher, or cloud component is introduced.

## 4. Default Windows storage location

Use:

```text
%LOCALAPPDATA%\friction
```

The versioned layout remains:

```text
%LOCALAPPDATA%\friction\v1\events
%LOCALAPPDATA%\friction\v1\tmp
%LOCALAPPDATA%\friction\v1\setup-locks
```

Rules:

- `FRICTION_HOME` overrides the default.
- Environment-variable lookup on Windows is case-insensitive.
- A Windows `FRICTION_HOME` must be fully qualified.
- Reject drive-relative values such as `C:friction`.
- Reject device namespaces such as `\\.\`, `\\?\`, and `\??\`.
- Reject UNC for the canonical private store in this PoC.
- If `LOCALAPPDATA` is missing and no override exists, fail with a fixed configuration error. Do not guess another directory.
- Use lowercase `friction` consistently in code and docs; Windows casing is not identity.

## 5. Shell contract

### PowerShell capture

Installed native-Windows guidance must use stdin and explicitly set UTF-8 without a BOM:

```powershell
$OutputEncoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
"<what you were doing -> what got in the way -> likely prevention>" |
  friction add --stdin --source codex
```

Replace `codex` with the correct source for each adapter. The setting is session-scoped. Do not modify a PowerShell profile.

### Git Bash capture

Use the existing POSIX form:

```sh
printf '%s\n' "<what you were doing -> what got in the way -> likely prevention>" |
  friction add --stdin --source claude-code
```

### Command Prompt

The CLI may be invoked from `cmd.exe`, but no managed capture snippet is required for Command Prompt in this PoC. PowerShell and Git Bash are the supported authored-text paths.

## 6. Harness contract

- Codex native Windows receives the PowerShell capture template.
- Claude Code native Windows is documented and tested through Git Bash.
- Generic setup on Windows prints both PowerShell and Git Bash forms with labels.
- A setup adapter must not guess a shell when the harness contract does not establish one.
- Skills remain shell-neutral prose except for examples that are labeled by shell.

## 7. Filesystem contract

- POSIX continues using mode bits and `O_NOFOLLOW` where available.
- Windows uses an explicit ACL policy and reparse-point inspection.
- No platform branch may silently weaken a safety check.
- Unsupported filesystem primitives return a safety or capability error rather than falling back to non-atomic writes.
- Local NTFS is the verified baseline.

## 8. Release claim

Before all native gates pass, documentation must say Windows support is in implementation or experimental validation. After all gates pass, the support statement may say:

> Friction supports macOS, Linux, and native Windows 11 x64. WSL follows the Linux support path. Native Windows requires Node.js 24; repository-aware behavior requires Git for Windows.

Do not say “Windows supported” without the architecture and baseline limitations elsewhere in the same support section.
