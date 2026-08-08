# 02 — Windows paths, reparse safety, and atomic filesystem plan

## 1. Create a platform-owned path boundary

Add cohesive platform modules rather than scattering `process.platform` branches:

```text
src/platform/runtime-platform.ts
src/platform/environment.ts
src/platform/safe-path.ts
src/platform/atomic-file.ts
src/platform/windows/path-policy.ts
src/platform/windows/reparse.ts
```

Existing callers should depend on typed operations such as `resolvePrivateHome`, `inspectSafePath`, `readRegularFileSafely`, `installExclusiveFile`, and `replaceFileAtomically`.

POSIX implementations retain current behavior where safe. Windows implementations use the rules below.

## 2. Windows path validation

For every user- or environment-selected path:

1. Reject NUL.
2. Reject drive-relative forms such as `C:tmp`.
3. Reject device namespaces beginning with `\\.\`, `\\?\`, or `\??\`.
4. Reject path components ending in a space or period.
5. Reject reserved DOS device names, including names followed by extensions:
   - `CON`, `PRN`, `AUX`, `NUL`;
   - `COM1` through `COM9`;
   - `LPT1` through `LPT9`.
6. Reject alternate-data-stream syntax (`:`) in user-selected filename components, except the drive designator.
7. Reject a UNC path for `FRICTION_HOME`.
8. Allow a repository or explicit export path on UNC only when all required safety and atomicity probes succeed; otherwise fail clearly.
9. Keep generated names short and safe; do not add extended-length `\\?\` prefixes in this PoC.

Use a small table-driven validator. Do not add a parser framework or enumerate theoretical Windows namespace forms that the product never accepts.

## 3. Case-insensitive containment

Windows path identity is case-insensitive by default. Scope checks must not rely on case-sensitive string prefixes.

Implement containment as follows:

1. Resolve the scope root to an absolute native path.
2. Canonicalize the nearest existing ancestor with `realpath.native`.
3. Validate remaining components without following reparse points.
4. Use `path.win32.relative(canonicalRoot, canonicalTarget)`.
5. Reject an absolute result, `..`, or a result beginning with `..\`.
6. Test drive-letter case changes and mixed-case path components.

Use this owner for setup scope, publish targets, export output, purge paths, and private-store paths. Remove duplicate local containment algorithms when the shared helper is proven.

## 4. Reparse-point policy

Node's `lstat().isSymbolicLink()` catches standard symlinks and junctions created through Node, but native Windows safety should inspect the `ReparsePoint` file attribute as well.

Use a static PowerShell/.NET inspection command through the same safe bridge as ACL work. It must return only:

```ts
type WindowsPathInspection = {
  exists: boolean;
  kind: "file" | "directory" | "other" | "missing";
  reparsePoint: boolean;
};
```

For every existing component from the trusted root to a target:

- reject any reparse point;
- reject a non-directory parent;
- reject a target of the wrong kind;
- stop before mutation if any component changes during planning or apply.

## 5. Replace direct `O_NOFOLLOW` use

`O_NOFOLLOW` is unavailable on Windows. Replace direct calls in event loading and publish inspection with one platform abstraction.

### POSIX safe read

- open with `O_RDONLY | O_NOFOLLOW`;
- verify a regular file through the handle;
- enforce byte bounds;
- read from the handle.

### Windows safe read

1. Inspect all existing components for reparse points.
2. `lstat` the target using bigint stats.
3. Require a regular file and enforce the pre-open size bound.
4. Open with `O_RDONLY`.
5. Read `FileHandle.stat({ bigint: true })`.
6. Reinspect the pathname and components.
7. Compare stable identity fields available on the platform, file kind, size, and modification metadata.
8. Read only through the already-open handle.
9. Reject any observed substitution or reparse change.

Do not claim this prevents a malicious same-user kernel-level race. The privacy boundary protects against accidental broad exposure and untrusted path redirection; the owning user already controls the store.

## 6. Exclusive event installation

Keep the current same-directory temporary-file plus hard-link installation model, subject to a real capability gate.

Sequence:

1. Create the temporary file with `open("wx")` inside the secured `tmp` directory.
2. Verify its ACL and non-reparse status.
3. Write the complete serialized event buffer.
4. Flush and close the handle.
5. Hard-link the temporary file to the final event name.
6. Treat existing final names as a collision and retry with a new event ID.
7. Remove the temporary link.
8. Verify the final file and ACL.

On `EPERM`, `EXDEV`, unsupported-operation errors, or a failed hard-link capability probe, fail safe. Do not copy and do not use a check-then-write fallback.

## 7. Atomic replacement

Setup, force export, and repository projection replace existing files. Centralize replacement:

1. Snapshot the expected target through safe read.
2. Stage a complete same-directory temporary file.
3. Flush and close it.
4. Recheck target path, digest, kind, ACL where private, and reparse status.
5. Rename temporary over target.
6. On Windows only, retry a small fixed number of times for known transient contention codes such as `EPERM`, `EBUSY`, or `EACCES`.
7. Before every retry, recheck the expected preimage. Abort on any change.
8. Never retry an ACL mismatch, path escape, reparse point, or changed digest.
9. Clean staged files on failure.

Use a fixed bounded schedule, not an open-ended loop. Directory flush remains best-effort and must not be described as a full crash-durability guarantee.

## 8. Lock files

Validate the existing `open("wx")` lock behavior on Windows:

- exclusive acquisition;
- concurrent loser receives contention;
- release removes the lock;
- no body or path content appears in lock names;
- lock root has the private ACL;
- stale lock behavior remains deterministic and bounded.

Do not replace locks with a daemon, named pipe, registry key, or native module.

## 9. Capability probing

Doctor and Windows acceptance must probe in an isolated child of the configured Friction root:

- exclusive `wx` creation;
- hard-link creation;
- rename-over-existing target;
- bounded lock contention;
- ACL inheritance;
- reparse-point rejection.

Every probe cleans up. A failed required probe makes private capture unsupported on that selected volume.

## 10. Acceptance criteria

- Local NTFS passes all primitives.
- A junctioned parent is rejected before reading or writing.
- `C:relative`, device paths, reserved names, and ADS paths are rejected.
- Case variations cannot escape scope checks.
- A changed preimage prevents replacement.
- Transient rename contention is bounded and never bypasses revalidation.
- No unsafe fallback is introduced on Windows or POSIX.
