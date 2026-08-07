# Setup, package runners, and harness adapters

## Distribution goal

The repository must produce a normal npm package with a `friction` binary. That
package shape permits execution through npm, Yarn, pnpm, Bun, or a persistent global
install without harness-specific runtime code.

Expected future forms after publication:

```text
npx <package> setup codex
npm exec --package <package> -- friction setup codex
yarn dlx <package> setup codex
pnpm dlx <package> setup codex
bunx <package> setup codex
```

The PoC remains `private: true` and must not publish. Verify the package contract with
a local tarball. Where Yarn, pnpm, or Bun are installed, run a best-effort local
package-runner smoke and report unverified runners honestly. Do not add those package
managers as dependencies.

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
- use one or two sentences: task context, obstacle/effect, optional prevention;
- call through stdin with the adapter source;
- record one distinct issue per task unless recurrence adds new evidence;
- do not record accomplishments, ordinary mistakes, tracked bugs, unsupported design
  opinions, secrets, transcripts, or large output;
- finish the immediate step and continue the primary task;
- continue if Friction capture fails;
- never log a Friction failure as another observation;
- never run transcript review automatically.

Example command in the asset:

```sh
printf '%s\n' "<what you were doing -> what got in the way -> likely prevention>" |
  friction add --stdin --source codex
```

Use the Claude source in the Claude adapter. The generic snippet uses `generic`.
Optional `--area` and `--impact` may be added only when obvious.

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
- install one versioned uniquely marked block;
- user skills target `$HOME/.agents/skills/friction-review/` and
  `$HOME/.agents/skills/friction-fix/`.

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
