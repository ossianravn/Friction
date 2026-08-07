# Friction

Friction is a personal, local-first feedback loop between one developer and coding
agents. It captures concrete avoidable task cost, keeps the canonical corpus private,
helps a coding harness review and fix verified patterns, and can explicitly project
selected sanitized records into a repository.

This proof of concept is private and unpublished. It targets Node.js 24 or newer and
has no runtime dependencies.

## Install from a local tarball

Build and verify the package in this repository:

```sh
npm install
npm run check
npm run pack:smoke
npm pack
```

Install the resulting tarball persistently so ambient capture does not invoke a package
runner on every observation:

```sh
npm install --global ./friction-0.0.0.tgz
friction --version
```

A package runner is useful for trying setup without a global install:

```sh
npm exec --package ./friction-0.0.0.tgz -- friction setup codex
```

Setup only warns when `friction` is absent from `PATH`; it never installs the CLI.

## Harness setup

Setup defaults to user scope and preview. Inspect the plan, then apply it explicitly:

```sh
friction setup codex
friction setup codex --apply
friction setup claude-code --apply
```

Use `--scope repo` inside a Git worktree for repository-local instructions and skills.
Undo is also preview-first:

```sh
friction setup codex --undo
friction setup codex --undo --apply
```

Codex and Claude Code adapters install a concise ambient capture instruction plus
separate `friction-review` and `friction-fix` skills. `friction setup generic` prints a
portable snippet and packaged skill paths without writing anything.

## Capture and inspect

Prefer stdin so authored text stays out of shell history:

```sh
printf '%s\n' "A stale setup guide caused a retry while configuring the project." |
  friction add --stdin --source manual --impact retry
```

The body is the only required authored field. Add `--area` or `--impact` only when it is
obvious. Successful capture returns a receipt without echoing the body.

```sh
friction list
friction list --status all --repo all
friction stats --status all
friction doctor
friction schema
```

Use `--json` for one versioned machine envelope.

## Review and fix

Ask the coding harness to use `friction-review` when you want a read-only analysis of
recurring friction, false evidence, likely priorities, and verified or refuted causes.
Review never changes code, configuration, projections, or lifecycle state.

Ask it to use `friction-fix` only with an explicitly named observation or reviewed
cluster. The fix workflow traces the owning production path, makes the smallest scoped
root fix, verifies it, and resolves exactly the records covered by that evidence.

Lifecycle can also be managed directly:

```sh
friction resolve fr_<full-id> --verification "Rechecked the original failing path."
friction reopen fr_<full-id> --note "The behavior recurred."
```

## Export, publish, and purge

`export` is a private read projection. It writes to stdout unless an output file is
explicitly selected:

```sh
friction export --status all
friction export --format jsonl --output ./friction-private.jsonl
```

`publish` is different: it is explicit repository sharing. Preview selected full IDs
or all current-repository open records, then apply:

```sh
friction publish fr_<full-id>
friction publish fr_<full-id> --apply
friction publish --all-open --apply
```

The default `.friction/observations.jsonl` contains only a strict sanitized allowlist.
It is not imported back, does not become canonical, and does not alter private lifecycle
state.

Purge is destructive and preview-first:

```sh
friction purge fr_<full-id>
friction purge fr_<full-id> --apply
```

Purge removes only matching private events. Exports, repository projections, commits,
backups, and copied files remain separate and must be managed separately.

## Privacy model

- Private user-local event files are the only canonical store.
- Agent-authored values are byte-bounded and screened for high-confidence secrets
  before persistence or sharing.
- Raw Git remotes and absolute repository roots are not persisted in public views.
- Capture never writes to the current repository.
- Setup, publish, undo, and purge previews perform no writes.
- There is no cloud service, telemetry, daemon, hook, transcript ingestion, background
  analysis, model API call, or automatic fix.

Set `FRICTION_HOME` to an isolated directory for development or testing. Never exercise
mutating setup, publish, or purge commands against live configuration or private data
without first reviewing their previews.

## Development

```sh
npm run check:lines
npm run typecheck
npm test
npm run build
npm run check
npm run pack:smoke
```

`npm run check` enforces the 300-line code-file limit, runs strict TypeScript checks,
executes the focused test suite, and builds the CLI. `npm run pack:smoke` creates a local
tarball in a temporary directory, installs it cleanly, checks packaged assets and the
binary version, then captures and lists across separate processes with an isolated home.

Initial dogfood should cover multiple repositories and both harnesses without hooks or
transcript mining. Use structural stats and periodic reviews; record any richer feature
only after repeated evidence justifies it.
