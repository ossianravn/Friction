# 01 — Windows privacy, ACL, and private-store plan

## 1. Why mode bits are insufficient

Node's Windows filesystem implementation does not provide POSIX owner/group/other permission semantics. Existing `0700` and `0600` arguments therefore cannot establish the privacy contract on native Windows.

Native support requires an explicit Windows DACL policy that is set and verified before private event bytes are persisted.

## 2. Exact ACL policy

### Store root and private directories

For `%LOCALAPPDATA%\friction`, `v1`, `events`, `tmp`, and `setup-locks`:

- owner: current process user SID;
- inheritance: protected/disabled;
- inherited ACEs: removed, not copied;
- allowed identities: current user SID and LocalSystem SID `S-1-5-18` only;
- access type: allow only;
- rights: `FullControl`;
- propagation: `ContainerInherit | ObjectInherit` on directories;
- explicit deny ACEs: none;
- broad identities such as Everyone, Users, or Authenticated Users: absent.

LocalSystem is the Windows analogue of permitting the operating system's privileged account. Administrators may still take ownership through operating-system privilege; Friction does not claim to protect a user from an administrator.

### Event, temporary, and lock files

Files must resolve to the same effective allowlist:

- current user SID;
- LocalSystem SID;
- no other allow or deny identities.

Inherited ACEs from the protected Friction root are acceptable if the effective identities and rights match the policy.

## 3. Implementation approach

Keep zero npm runtime dependencies. Use a narrow, static PowerShell/.NET bridge for Windows security descriptors.

Add:

```text
src/platform/windows/powershell.ts
src/platform/windows/acl.ts
src/platform/windows/acl-script.ts
```

Responsibilities:

- `powershell.ts`: invoke a fixed script safely and parse bounded JSON.
- `acl-script.ts`: own the static encoded PowerShell program; no user text interpolation.
- `acl.ts`: expose typed operations such as `securePrivateDirectory`, `verifyPrivateDirectory`, and `verifyPrivateFile`.

Every file remains below 300 lines. Split inspection and mutation only if ownership is genuinely clearer.

## 4. Safe PowerShell bridge

Invoke the built-in executable using an absolute path derived from `SystemRoot`:

```text
%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe
```

Use:

- `-NoLogo`;
- `-NoProfile`;
- `-NonInteractive`;
- `-EncodedCommand` with UTF-16LE Base64;
- `windowsHide: true`;
- stdin ignored;
- bounded stdout and stderr;
- a short timeout;
- one normalized case-insensitive environment map.

Pass the target path through a dedicated process environment value, never by inserting it into the script or command arguments. Never pass event bodies or secrets.

The script returns compact JSON containing only safe facts:

```ts
type WindowsAclResult = {
  ok: boolean;
  ownerMatches: boolean;
  inheritanceProtected: boolean;
  unexpectedAceCount: number;
  missingRuleCount: number;
};
```

Do not return raw SDDL, usernames, SIDs, paths, or ACE text to normal CLI output.

## 5. PowerShell/.NET operations

The static script should:

1. Read the target path from the process environment.
2. Obtain the current SID with `WindowsIdentity.GetCurrent().User`.
3. construct `SecurityIdentifier("S-1-5-18")` for LocalSystem.
4. Use `DirectorySecurity` or `FileSecurity` according to the expected kind.
5. Set the owner to the current SID.
6. Call `SetAccessRuleProtection(true, false)` to disable inheritance and remove inherited ACEs when securing the root.
7. Remove existing explicit access rules from the security object.
8. Add only the required current-user and LocalSystem allow rules.
9. Persist with the .NET ACL API or `Set-Acl -LiteralPath`.
10. Re-read and verify the effective descriptor.
11. Emit one JSON object and exit nonzero on any mismatch.

Do not parse localized `icacls` output in production. `icacls` may be used only for manual troubleshooting documentation.

## 6. Store creation sequence

Implement a single Windows-owned sequence:

1. Resolve and validate the intended Friction home.
2. Inspect every existing parent component for reparse points.
3. If the Friction root is absent, create only that root directory.
4. Immediately apply and verify the exact protected ACL on the root.
5. Only after root verification, create `v1`, `events`, `tmp`, and `setup-locks` beneath it.
6. Verify child directories inherit only the allowed identities.
7. Create a private temporary file inside `tmp`.
8. Verify the temporary file ACL before writing event bytes.
9. Write, flush, and install the event atomically.
10. Verify the installed event file before reporting success.

No event body may be written before steps 1–8 succeed.

## 7. Existing-path behavior

- Existing safe Friction root: verify and continue.
- Existing root with broader or unknown ACL: fail with `safety_failure`; do not silently rewrite it during capture.
- Existing root containing unknown files before first supported Windows run: fail and direct the user to inspect with doctor or select a new empty `FRICTION_HOME`.
- Wrong owner, reparse point, inaccessible descriptor, unsupported filesystem, or unverifiable ACL: fail closed.
- Do not create an automatic repair command in this milestone.

Setup application may create the store for lock files only after the same ACL sequence succeeds. Preview remains zero-write and therefore must not initialize the store.

## 8. Reads and lifecycle operations

Before reading private events or changing lifecycle state:

- verify the Friction root and events directory policy;
- reject event files with an unsafe ACL;
- record a safe doctor finding without showing body content;
- do not load or fold an unsafe event;
- make purge fail if any ACL or event finding exists.

The user who owns the store can intentionally change it, but Friction must not silently treat a broadened store as private.

## 9. Doctor behavior

Add checks for:

- selected Windows data root;
- local path versus prohibited UNC/device path;
- owner match;
- inheritance protection;
- required current-user and LocalSystem rules;
- unexpected ACE count;
- private file inheritance;
- ACL bridge availability and bounded execution;
- filesystem atomic capability probes.

Doctor messages must be safe summaries. Do not print raw SDDL, SID values, usernames, or private bodies.

## 10. Acceptance criteria

1. A newly created store passes the exact ACL policy.
2. A second unrelated local user cannot read an event in a privileged acceptance environment; when CI cannot create that user, exact DACL inspection is the automated proof and a manual Windows 11 pass supplies the access attempt.
3. Broad inherited permissions are absent.
4. Capture refuses a deliberately broadened store without writing event bytes.
5. Capture refuses a junctioned or device-path store.
6. Setup preview creates no ACL, directory, lock, or cache state.
7. Doctor detects drift without exposing private values.
8. No POSIX platform behavior regresses.
