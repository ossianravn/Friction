# Native Windows current-scope addendum

Status: implementation authorized; native support remains under validation

## Scope change

Native Windows support is part of the current Friction PoC. This addendum supersedes
only earlier clauses that defer native Windows, limit the supported implementation to
macOS/Linux, treat WSL as the only Windows path, exclude Windows filesystem tests, or
accept Linux-only CI as final evidence.

The detailed implementation contract is the ordered bundle under:

```text
.dev-docs/friction-native-windows-plan/
```

Its `README.md` and documents `00` through `07` define the W0–W8 dependency gates,
security policy, code ownership, tests, CI, documentation timing, and release proof.
Later, narrower documents in that bundle refine this addendum.

## Support status during implementation

Until every native release gate passes, public documentation must describe native
Windows support as under validation or unsupported. A compiling `win32` branch, Linux
fixture tests, or WSL success is not evidence of native Windows support.

The first intended native claim is limited to:

- Windows 11 x64 for users;
- Windows Server 2025 x64 for mandatory CI;
- Node.js 24 and npm;
- local NTFS for the private store;
- PowerShell 7 and the documented Windows PowerShell 5.1 UTF-8 capture form;
- Git for Windows;
- native Codex on Windows;
- native Claude Code through its documented Git Bash path.

Windows ARM64, Windows 10, canonical private UNC storage, non-NTFS private storage,
native installers, package-manager distribution, and automatic PATH changes remain
unclaimed.

## Unchanged product invariants

- The private user-local event store remains the only canonical store.
- Ordinary capture never writes into the current repository.
- Redaction runs before persistence and public projection.
- Setup, publish, purge, and undo remain preview-only without `--apply`.
- Repository publication remains explicit, sanitized, and noncanonical.
- The CLI remains deterministic, model-free, and free of runtime npm dependencies.
- The one-file-per-event format, strict TypeScript, Node 24, npm, and 300-line code
  limit remain fixed.
- Teams, cloud sync, telemetry, hooks, transcript mining, MCP, daemons, native addons,
  automatic fixes, and release machinery remain out of scope.

## Windows privacy and filesystem contract

The default private root is `%LOCALAPPDATA%\friction`; `FRICTION_HOME` may override it
only with a validated fully qualified local path. Native Windows must use an explicit
verified access-control list allowing only the current user and LocalSystem. POSIX mode
bits are not an equivalent Windows privacy control.

Private bytes must not be written until the ACL is secured and verified. Unsafe or
unverifiable ACLs, reparse points, device paths, private UNC paths, changed preimages,
or unavailable required atomic primitives fail closed. No platform-specific fallback
may weaken the macOS/Linux guarantees.

## Verification authority

Pure path and environment policy may be tested with fixtures on any platform. ACL,
NTFS, junction, PowerShell, Git for Windows, PATHEXT, npm `.cmd`, and native harness
claims require real Windows evidence.

The final support claim requires:

1. clean Linux, macOS, and pinned Windows Server 2025 CI;
2. native ACL, reparse, atomicity, concurrency, package-shim, setup, and command
   acceptance;
3. PowerShell 5.1, PowerShell 7, and Git Bash Unicode capture;
4. a Windows 11 x64 dogfood pass in native Codex and Claude Code;
5. no unresolved high-severity native Windows finding.

Do not publish, release, or make an unconditional native-Windows support statement
without separate authorization after those gates pass.
