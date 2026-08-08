# 06 — Concrete code map and responsibility split

This map tells Codex where each change belongs. Inspect callers before editing and keep every code file at or below 300 physical lines.

## 1. Existing files to change

| File | Required change |
|---|---|
| `src/storage/paths.ts` | Delegate platform home selection and safe-directory policy; add win32 path support without retaining scattered platform branches. |
| `src/storage/event-store.ts` | Use secure store initialization, ACL verification, and shared exclusive install. Do not write bytes before the Windows security gate. |
| `src/storage/load-events.ts` | Replace direct `O_NOFOLLOW` with shared safe read; validate ACL and canonical event limits. |
| `src/platform/fs.ts` | Reduce to shared facade or split atomic operations into cohesive owners; preserve POSIX behavior. |
| `src/platform/path.ts` | Replace exact-name/X_OK-only logic with platform-aware command resolution and PATHEXT support. |
| `src/platform/git.ts` | Use normalized environment, `windowsHide`, canonical Git commands, and three-state failures. |
| `src/publish/target.ts` | Use shared containment, reparse walk, safe read, and Windows path policy. |
| `src/publish/apply.ts` | Use shared atomic replacement and bounded Windows contention handling. |
| `src/setup/files.ts` | Use shared safe read/path inspection and per-target roots. |
| `src/setup/plan.ts` | Select platform-specific capture assets and snapshot Codex precedence. |
| `src/setup/target-plan.ts` | Recognize current and known prior owned-asset digests. |
| `src/setup/apply.ts` | Use secure locks, full preflight, staged cleanup, per-target roots, precedence recheck, and atomic replacement. |
| `src/setup/assets.ts` | Own asset IDs, current digests, and small prior-digest allowlists. |
| `src/doctor/checks.ts` | Add Windows ACL, atomic capability, reparse, PATHEXT, and path checks without exposing private values. |
| `src/cli/schema.ts` | Describe win32, effects, environments, ACL/capability contract, and distinct event/public shapes. |
| `src/cli/run.ts` and help owner | Render platform-relevant help from shared command metadata. |
| `src/domain/failures.ts` | Add or refine fixed configuration/capability errors; keep generic I/O text operation-neutral. |
| `assets/instructions/capture.md` | Replace with explicit POSIX and PowerShell assets or a generated shared-prose model. |
| `scripts/pack-smoke.mjs` | Add Windows npm-shim execution and hardened stdin handling. |
| `test/support/process.ts` | Use ignored stdin when empty and single-settlement EPIPE-safe behavior. |
| `.github/workflows/check.yml` | Add macOS and pinned Windows matrix lanes using current action majors. |
| `README.md` | Add exact native Windows support, install, shell, storage, and limitation guidance. |

## 2. New platform modules

Recommended owners:

```text
src/platform/runtime-platform.ts
src/platform/environment.ts
src/platform/safe-path.ts
src/platform/atomic-file.ts
src/platform/windows/path-policy.ts
src/platform/windows/reparse.ts
src/platform/windows/powershell.ts
src/platform/windows/acl-script.ts
src/platform/windows/acl.ts
```

Do not create every file blindly. Start with these responsibility boundaries, then combine only where the resulting module stays cohesive and comfortably below 300 lines.

## 3. Required public types

### Platform

```ts
type RuntimePlatform = "darwin" | "linux" | "win32";
```

### Repository discovery

```ts
type RepositoryDiscovery =
  | { state: "not-repository" }
  | { state: "repository"; context: RepositoryContext }
  | { state: "repository-unavailable"; reason: RepositoryFailure };
```

### Filesystem capability

```ts
type FileCapabilities = {
  exclusiveCreate: boolean;
  hardLinkInstall: boolean;
  replaceExisting: boolean;
  lockFile: boolean;
};
```

### Safe path inspection

```ts
type SafePathInspection = {
  exists: boolean;
  kind: "file" | "directory" | "other" | "missing";
  reparsePoint: boolean;
};
```

### Windows ACL result

```ts
type WindowsAclResult = {
  ok: boolean;
  ownerMatches: boolean;
  inheritanceProtected: boolean;
  unexpectedAceCount: number;
  missingRuleCount: number;
};
```

Keep these types honest. Do not use nullable fields to combine materially different states.

## 4. Function-level ownership

### Environment

- `getEnvironmentValue(name)` — case-insensitive only on win32.
- `buildChildEnvironment(overrides)` — emits one canonical key per case-insensitive name.

### Path

- `resolvePrivateHome()` — platform-specific default and override validation.
- `assertSafeAbsolutePath(path, purpose)` — rejects unsupported Windows forms.
- `assertPathInsideRoot(root, target)` — canonical, platform-correct containment.
- `inspectPathComponents(root, target)` — no reparse or wrong-kind parent.

### File operations

- `readRegularFileSafely(path, maximumBytes)`.
- `installExclusiveFile(tempRoot, finalPath, bytes)`.
- `replaceFileAtomically(snapshot, desiredBytes)`.
- `probeFileCapabilities(directory)`.

### Windows security

- `securePrivateDirectory(path)`.
- `verifyPrivateDirectory(path)`.
- `verifyPrivateFile(path)`.

### Executable discovery

- `resolveCommandOnPath(name)` returns resolved path and kind or null.
- `executableOnPath(name)` may remain as a boolean wrapper for current callers.

## 5. Error ownership

Use fixed, non-sensitive errors. Suggested distinctions:

- unsupported platform: only for genuinely unsupported platforms after win32 exists;
- invalid input: invalid path form or CLI value;
- configuration error: missing required Windows environment such as `LOCALAPPDATA`;
- safety failure: ACL, reparse, path, or redaction invariant failed;
- capability unavailable: selected filesystem lacks a required atomic primitive;
- setup/publish conflict: changed preimage or scope;
- temporary contention: bounded retry may be useful;
- generic I/O: operation-neutral and non-retryable by default.

Do not include raw operating-system messages, absolute private paths, SDDL, or bodies in JSON errors.

## 6. Test ownership

Prefer extending existing tests. Add at most:

```text
test/windows/security.test.ts
test/windows/cli-package.test.ts
```

The CI lane, not platform mocks, is the proof for Windows behavior.

## 7. Modularity review after every milestone

Before finishing a milestone:

1. Run the line-count guard.
2. Inspect any file above 240 lines for mixed ownership before it reaches 300.
3. Remove duplicated platform conditionals from callers.
4. Confirm no generic “windows-utils” dumping ground appeared.
5. Confirm tests use public boundaries rather than private helper snapshots.
6. Confirm no runtime dependency or shell interpolation was added.
7. Review the final production data flow, not only test output.
