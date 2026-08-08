# 07 — Required PRD, help, schema, and documentation changes

## 1. Create a current-scope PRD addendum

Add a short repository document such as:

```text
.dev-docs/friction-prd/16-NATIVE-WINDOWS.md
```

Keep it below 220 lines. It should point to this implementation plan or incorporate its final decisions.

The addendum must state that it supersedes only the earlier native-Windows deferral clauses. It does not reopen teams, cloud sync, hooks, transcript mining, SQLite, MCP, or other non-goals.

## 2. Amend earlier deferral language

Search all `.dev-docs`, README, skills, and setup assets for:

- `Windows`;
- `WSL`;
- `win32`;
- `unsupported_platform`;
- `macOS and Linux`;
- `POSIX`;
- shell examples using `printf`.

Update the specific clauses that say:

- native Windows is deferred;
- WSL is the Windows support path;
- only darwin/linux storage paths exist by design;
- Linux-only CI is sufficient.

Do not rewrite unrelated PRD content.

## 3. README support section

Add one explicit support matrix:

| Environment | Status | Notes |
|---|---|---|
| macOS | Supported | Node 24. |
| Linux | Supported | Node 24. |
| Windows 11 x64 | Supported after native gates pass | Node 24; Git for Windows for repository features. |
| Windows Server 2025 x64 | CI-supported | Mandatory hosted runner lane. |
| WSL | Supported through Linux behavior | Keep project and private store in the Linux filesystem when possible. |
| Windows ARM64 | Not yet claimed | Architecture-neutral implementation; requires full native acceptance. |

Add PowerShell and Git Bash examples separately. Never put a POSIX pipeline under an unlabeled Windows heading.

## 4. Privacy documentation

Document:

- default `%LOCALAPPDATA%\friction` path;
- `FRICTION_HOME` override requirements;
- exact current-user plus LocalSystem ACL policy;
- fail-closed behavior when ACLs cannot be verified;
- local-NTFS verified baseline;
- private UNC store not supported in this PoC;
- doctor checks and safe messages;
- no claim of protection from an administrator who can take ownership.

## 5. Setup documentation

Document:

- Codex native Windows receives PowerShell guidance;
- Claude Code native Windows uses its documented Git Bash setup;
- generic Windows setup prints both shell variants;
- preview creates no files, directories, ACLs, locks, or store;
- custom `CODEX_HOME` may be outside `HOME` and remains path-scoped;
- CRLF is preserved;
- setup never modifies PowerShell profiles or installs the CLI.

## 6. Help metadata

Top-level help should state supported platforms and direct agents to `schema`.

Command help must communicate relevant Windows behavior:

- `add --stdin` is the agent-safe path;
- query scope and explicit `--repo all` widening;
- setup/publish/purge preview/apply semantics;
- PowerShell and Git Bash setup distinction;
- Windows private-store location;
- destructive purge boundary.

Use concise static metadata, not long generated manuals.

## 7. Schema changes

Add machine-readable fields for:

```json
{
  "platforms": {
    "darwin": { "supported": true },
    "linux": { "supported": true },
    "win32": {
      "supported": true,
      "privateStore": "%LOCALAPPDATA%\\friction",
      "requiresAclVerification": true,
      "privateUncStore": false
    }
  }
}
```

Also include:

- `LOCALAPPDATA`, `CODEX_HOME`, `PATH`, `PATHEXT`, `SystemRoot`, and `ComSpec` as relevant environment inputs;
- command effects as booleans rather than opaque mutation strings;
- Windows path restrictions;
- ACL and filesystem capability requirements;
- projection remains noncanonical;
- error and exit-code contracts;
- supported shell templates by adapter/platform.

Do not expose resolved environment values.

## 8. Skills

Review `friction-review` and `friction-fix` for POSIX-only examples. Keep their decision logic unchanged.

Where commands are necessary:

- prefer shell-neutral wording;
- label PowerShell and Git Bash examples;
- never tell the agent to use `printf` in native Codex PowerShell;
- keep review read-only and fix authorization explicit.

## 9. Support-claim timing

During implementation, documentation may say “native Windows support is under validation.”

Change it to “supported” only after the release gate in `05-TEST-CI-ACCEPTANCE.md` is complete. Do not merge a support claim merely because the `win32` storage branch compiles.

## 10. No elapsed-time estimate

Do not add a “3–5 days,” “one week,” or similar estimate to the PRD, README, issues, or handoff. The actionable unit is the milestone and its evidence. Report blocked gates, not speculative human elapsed time.
