# Security, redaction, and repository attribution

## Security objective

Friction receives free-form text from agents immediately after failures. Assume that
an agent will eventually try to include a token, private URL, absolute path, or raw
output. The PoC must reduce accidental retention before any user-controlled text
reaches durable storage or shareable output.

This is high-confidence redaction, not complete data-loss prevention. Documentation
and installed guidance must still prohibit secrets and large raw output.

## Redaction boundary

Redact before:

- event construction and persistence;
- output formatting or diagnostic interpolation;
- hashing any user-controlled repository preimage;
- export and publication;
- setup plan display when managed content contains user-derived paths.

Apply screening to:

- observation body;
- model;
- lifecycle note and verification;
- repository display name, branch, and relative working directory;
- normalized remote preimage before hashing;
- any future user-controlled metadata.

Never write an unredacted preimage to a temp file, log, error, backup, database,
projection, or test artifact.

## PoC redaction rules

Detect only high-confidence forms:

- PEM private-key blocks;
- `Authorization:` header values;
- `Cookie:` header values;
- URLs containing username/password credentials;
- assignments whose key clearly contains `token`, `secret`, `password`, `passwd`, or
  `key`;
- recognized credential prefixes, initially GitHub, OpenAI-style `sk-`, and Slack
  `xox*` forms.

Use class-only markers:

```text
[REDACTED:PRIVATE_KEY]
[REDACTED:AUTHORIZATION]
[REDACTED:COOKIE]
[REDACTED:URL_CREDENTIAL]
[REDACTED:SECRET]
[REDACTED:CREDENTIAL]
```

Requirements:

- deterministic pure function;
- simple bounded patterns;
- no entropy scoring;
- no correlation hash or secret-derived token;
- no allow-raw flag, recovery vault, or debug dump;
- return screened text, replacement count, and ruleset version;
- byte limits run before regex work;
- failure is fail-closed with exit code 6 and nothing persisted.

Do not redact ordinary words merely because they contain “key.” False positives in
prose destroy the usefulness of the corpus. Secret-assignment matching must require a
clear assignment structure.

## Safe error policy

Known errors are selected from a fixed registry. Callers provide an error code and
safe structured context, not arbitrary messages containing rejected input.

Errors must never echo:

- observation body;
- rejected secret candidate;
- raw remote;
- absolute repository root;
- environment variable values;
- existing instruction-file contents;
- corrupt event body.

A path may be shown only when it is a user-requested export/setup target or the private
Friction home path. Doctor may show the resolved home path but not record contents.

## Private data directory

Resolution order:

1. `FRICTION_HOME`, when non-empty.
2. macOS: `~/Library/Application Support/friction`.
3. Linux: `$XDG_DATA_HOME/friction` when set, otherwise
   `~/.local/share/friction`.
4. Other platforms: report unsupported for the PoC unless the path naturally resolves
   through `FRICTION_HOME`.

Requirements:

- create the root directory with mode `0700`;
- event and temporary files use mode `0600`;
- recheck and warn through `doctor` when permissions are broader;
- do not silently chmod unrelated parent directories;
- reject a Friction home that is a symlink if safe canonical ownership cannot be
  established;
- tests always use an isolated `FRICTION_HOME`.

## Repository context objective

Associate observations across subdirectories and worktrees without storing raw remote
URLs in the event or exposing absolute roots in list/export/publish output.

Repository discovery is best-effort. An unexpected Git failure must not block an
otherwise safe capture; store `repository: null` and return a safe warning.

## Git discovery

Use the `git` executable through one narrow platform boundary. Do not parse `.git`
files manually when Git can supply the answer.

Collect, when available:

- top-level worktree path;
- Git common directory;
- branch or detached state;
- full HEAD SHA;
- remote candidates;
- current directory relative to worktree.

Do not run Git inside a storage transaction or while holding a shared mutation lock.
The event-file store should need no capture lock.

## Repository identity

Branches and worktrees are context, not identity.

1. Prefer remote `origin` when present.
2. Otherwise use the sole remote when exactly one exists.
3. When remotes are absent or ambiguous, use local Git common-directory identity.
4. Normalize supported HTTPS, SSH URL, and SCP-style remotes:
   - remove userinfo, password, query, and fragment;
   - lowercase host;
   - normalize separators and default ports;
   - remove trailing slash and `.git`;
   - preserve repository path case.
5. Redact/screen the normalized remote preimage.
6. Only when screening makes zero replacements, hash
   `remote:<normalized-value>` with SHA-256.
7. Otherwise discard the remote preimage and hash
   `local:<real-git-common-dir>`.
8. Never persist either raw preimage.

The stored `RepositoryContext` is:

```ts
type RepositoryContext = {
  key: string;                 // sha256 hex, private internal identity
  name: ScreenedText;
  branch: ScreenedText | null;
  head: string | null;         // validated full hex SHA
  cwdRelative: ScreenedText;
};
```

`key` is allowed in the private event only. Human list output, export, publication,
and add receipts omit it.

## Repository display rules

- Derive `name` from the normalized remote’s final path segment when safe, otherwise
  from the worktree basename after screening.
- Store a POSIX-style relative `cwdRelative`; use `.` at the root.
- Reject a computed relative path that escapes with `..`; fall back to null repository
  context rather than storing an absolute path.
- Validate branch and SHA shapes before storage.
- Do not capture usernames, hostnames, full process arguments, or all environment
  variables.

## Secret-canary invariant

The acceptance suite must use synthetic secrets and prove they are absent byte for
byte from:

- final event files;
- any temp event bytes produced by the tested write path;
- list, stats, export, publish preview, and publish output;
- stdout and stderr for representative success and error paths;
- doctor results.

One table-driven canary scenario is enough. Do not multiply tests for every marker.
