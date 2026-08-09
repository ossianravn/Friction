# Setup, package runners, and harness adapters

## Distribution goal

The repository must produce a normal npm package with a `friction` binary. That
package shape permits execution through npm, Yarn, pnpm, Bun, or a persistent global
install without harness-specific runtime code.

Supported package-runner forms after publication:

```text
npx @ossianravn/friction setup codex
npm exec --package @ossianravn/friction -- friction setup codex
yarn dlx @ossianravn/friction setup codex
pnpm dlx @ossianravn/friction setup codex
bunx @ossianravn/friction setup codex
```

The approved public package is `@ossianravn/friction`, while its executable remains
`friction`. Verify the package contract with a local tarball before every release.
Where Yarn, pnpm, or Bun are installed, run a best-effort local package-runner smoke
and report unverified runners honestly. Do not add those package managers as
dependencies or replace npm as the development package manager.

Package runners are for try/setup/install. Ambient capture should invoke a persistent
plain `friction` binary on `PATH`; do not make every observation download or resolve a
package.

## Setup command

```text
friction setup codex|claude-code|generic
  [--scope user|repo]
  [--apply]
  [--undo]
```

Defaults:

- user scope;
- preview only;
- apply and undo are mutually exclusive actions, with undo also preview-only unless
  `--apply` is present.

Preview must make literally zero writes: no home directory, event store, target
parent, lock, temp file, cache, or timestamp.

## What setup installs

For Codex and Claude Code, setup manages:

1. a concise persistent capture instruction;
2. a `friction-review` skill;
3. a `friction-fix` skill.

The instruction is ambient. The skills are explicit workflows. Do not put the whole
review algorithm into always-loaded instructions.

Setup must verify that `friction` is discoverable on `PATH`. A missing binary is a
warning in preview and apply output, not permission to auto-install anything.

## Managed capture instruction

The shipped instruction must communicate:

- record concrete avoidable friction without asking the user;
- include design, ownership, stale docs/guides, misleading abstractions, scripts,
  tooling, tests, dependencies, configuration, and harness friction;
- capture when it causes retry, backtracking, workaround, extra search, blocking,
  false evidence, slow path, or unclear ownership;
- define false evidence as plausible wrong or incomplete output that appears successful;
- use one or two sentences: task context, observed obstacle/cost, useful workaround;
- state facts first and label unverified cause or prevention as suspected;
- call through literal-safe stdin with the adapter source;
- record each encounter once and another recurrence only for another concrete cost;
- omit optional metadata rather than guess;
- exclude accomplishments, preference-only criticism, ordinary mistakes without a
  missing guardrail, and the tracked bug itself;
- exclude secrets, transcripts, environment values, diffs, and raw or large output;
- finish the immediate step, capture before context is lost, and continue the task;
- continue if Friction capture fails;
- never log a Friction failure as another observation;
- never run transcript review automatically.

POSIX and Git Bash command in the asset:

```sh
friction add --stdin --source codex <<'FRICTION_NOTE'
<what you were doing -> what happened and what it cost -> workaround or suspected prevention>
FRICTION_NOTE
```

Use the Claude source in the Claude adapter. The generic snippet uses `generic`.
Omit optional metadata rather than guess.

Native Windows Codex uses a PowerShell form that sets a no-BOM UTF-8
`$OutputEncoding` and sends a single-quoted here-string through stdin. Native Windows
Claude Code uses the quoted-delimiter POSIX heredoc through its documented Git Bash
path. Generic Windows setup prints both forms with explicit shell labels.

## Safe setup plan

Adapters return an in-memory plan containing:

- harness and scope;
- canonical scope root;
- target paths;
- target kind: managed block or adapter-owned file;
- original existence, mode, newline style, and digest;
- desired bytes;
- safe mutation summary;
- skill assets to create/update/delete.

Plans are never serialized. Do not include full existing file content in output.

## Shared apply and undo rules

- Reject symlinked targets and symlinked existing parent components.
- Reject paths outside the canonical selected scope.
- Reject malformed or duplicate managed markers.
- Preserve unrelated bytes, newline style, and existing mode.
- Recheck target digest immediately before mutation.
- On apply only, serialize setup for one scope with a bounded private lock under
  `FRICTION_HOME/v1/setup-locks/`, keyed by a hash of the canonical scope root.
- After acquiring the lock, recheck every target path and digest before any mutation.
- Write same-directory exclusive temp files and atomically rename.
- New adapter-owned files use mode `0600` in user scope and normal repository mode in
  repo scope.
- Repeated apply is an idempotent success.
- Repeated undo is an idempotent success.
- Delete a file only when it is entirely adapter-owned.
- Do not create broad backup copies of configuration.
- Discover every precondition conflict before mutation so conflicts cause no partial
  changes. Stage all desired bytes first. Report any unexpected mid-commit I/O failure
  precisely; do not claim all-or-nothing guarantees against non-cooperating editors.

A compact preflight and staged temp-file plan is sufficient. Do not build a generic
configuration transaction framework.

## Codex adapter

Use current official Codex discovery rules at implementation time.

User scope:

- resolve `CODEX_HOME`, default `~/.codex`;
- target non-empty `AGENTS.override.md` when active, otherwise `AGENTS.md`;
- append one versioned uniquely marked block after unrelated existing instructions;
- relocate a recognized legacy Friction block to that position on reapply;
- user skills target `$HOME/.agents/skills/friction-review/` and
  `$HOME/.agents/skills/friction-fix/`.

On native Windows, resolve `CODEX_HOME` case-insensitively and install the PowerShell
capture form. `CODEX_HOME` may be outside `HOME`; each target keeps its own canonical
ownership root. Preserve CRLF and never edit a PowerShell profile.

Repository scope:

- require current Git worktree;
- target non-empty root `AGENTS.override.md` when active, otherwise root `AGENTS.md`;
- skills target `.agents/skills/friction-review/` and `.agents/skills/friction-fix/`.

Markers:

```text
<!-- friction:managed:start v1 -->
...
<!-- friction:managed:end v1 -->
```

Do not modify a file whose active precedence cannot be established safely. Report a
setup conflict rather than claiming installation in a shadowed file.

## Claude Code adapter

Use current official Claude Code paths at implementation time.

On native Windows, use Windows paths for owned files and the POSIX capture form for
Claude Code's documented Git Bash environment.

User scope:

- capture rule: `~/.claude/rules/friction.md`;
- skills: `~/.claude/skills/friction-review/` and `friction-fix/`.

Repository scope:

- capture rule: `.claude/rules/friction.md`;
- skills: `.claude/skills/friction-review/` and `friction-fix/`.

These are adapter-owned files. Apply writes exact shipped content. Undo deletes only
when the file still matches a known managed digest; changed files are conflicts.

## Generic adapter

- Print the portable capture snippet and paths to the packaged skill directories.
- Reject `--apply` and `--undo`; no safe target can be inferred.
- Perform no writes.

## Setup JSON data

Return:

```ts
{
  harness: "codex" | "claude-code" | "generic";
  scope: "user" | "repo";
  action: "preview-apply" | "apply" | "preview-undo" | "undo";
  state: "create" | "update" | "remove" | "noop" | "conflict";
  mutations: Array<{ path: string; kind: string; state: string }>;
  snippet: string | null;
}
```

Paths are expected setup targets and may be shown. Never include existing contents or
unredacted environment values.
