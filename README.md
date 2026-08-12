# Friction

Friction helps coding agents remember what made your work harder—not only what they
finished.

Imagine that your coding agent completes a task, but only after it follows an outdated
guide, searches in the wrong place, and works around a misleading test command. The task
is done, so those problems usually disappear from view. The next agent can lose time to
the same problems again.

Friction gives your agent a private place to leave a short note when that happens. Later,
you can ask an Agent Skills-compatible coding agent to review those notes, find repeated
problems, verify the likely causes against the current code, and recommend what is worth
fixing first.

Nothing is reviewed, changed, or shared in the background. You decide when review happens,
which fix is allowed, and whether any record should be added to a repository.

Friction is an early public release for one developer working across one or more
repositories. Its local-first privacy and explicit-control boundaries remain the core
product contract while real-world dogfood continues.

## Platform status

| Environment | Status | Notes |
|---|---|---|
| macOS | Supported | Node.js 24. |
| Linux | Supported | Node.js 24. |
| Windows 11 x64 | Supported | Native Node.js 24; Git for Windows for repository-aware behavior and Claude Code. |
| Windows Server 2025 x64 | CI target | The mandatory pinned hosted-runner matrix is green. |
| WSL | Supported through Linux behavior | Prefer the Linux filesystem for the project and private store. |
| Windows ARM64 | Not yet claimed | Requires its own complete native acceptance pass. |

The native Windows 11 x64 baseline has passed its private ACL, local-NTFS, npm command
shim, Git for Windows, isolated setup lifecycle, native Codex and Claude Code dogfood,
and the pinned Windows Server 2025 CI matrix. Windows ARM64 and private UNC storage
remain outside the supported baseline.

## The workflow in plain language

1. You work with your coding agent as usual.
2. When the agent encounters an avoidable obstacle, it records one short private note and
   continues the main task.
3. When you are ready, you ask the agent to review the accumulated notes.
4. The agent groups repeated problems and checks whether the suspected causes are real.
5. You choose one verified problem and explicitly authorize a fix.
6. The agent fixes that problem, verifies the original path, and marks only the addressed
   notes as resolved.

Friction calls each note an **observation**. An observation is one or two sentences about
what the agent was trying to do, what got in the way, and what effect that had.

## Get started

The five steps below are the complete first-use path. Everything after them is reference
for when you need more control.

### 1. Install Friction

You need:

- Node.js 24 or newer;
- npm or pnpm; and
- a shell-capable coding agent or agent framework.

Install Friction globally with npm:

```sh
npm install --global @ossianravn/friction
friction --version
```

Or install the same package globally with pnpm:

```sh
pnpm add --global @ossianravn/friction
friction --version
```

For a one-off inspection without a persistent install, use:

```sh
npx --yes @ossianravn/friction --version
pnpm dlx @ossianravn/friction --version
```

The global install matters because your coding agent needs a stable `friction` command on
`PATH`. Friction setup never installs the command for you.

Install Friction in the same environment where your coding agent runs. Native Windows
and WSL are separate environments: each has its own command installation, setup, and
private Friction store. If you use both, install and configure both separately.

#### Update Friction

Update the global package with the same package manager you used to install it:

```sh
npm install --global @ossianravn/friction@latest
```

Or with pnpm:

```sh
pnpm add --global @ossianravn/friction@latest
```

If npm reports `EEXIST` for the `friction` executable, do not use `--force`. An
older global package or a different package manager still owns that command. Inspect
the current global package owner first:

```sh
npm list --global --depth=0
```

If that output lists the pre-release unscoped `friction@0.0.0` development install,
migrate once with:

```sh
npm uninstall --global friction
npm install --global @ossianravn/friction@latest
```

Use `pnpm remove --global friction` instead when pnpm created the old install. Continue
updating with the same package manager afterward. Once the scoped package owns the
`friction` executable, normal updates replace it without this migration step.

After every package update, confirm the installed version, inspect the available
integrations, then preview and reapply each setup you use in that environment:

```sh
friction --version
friction setup --list
friction setup codex
friction setup codex --apply
friction doctor --integration codex
```

Updating the package does not rewrite installed instructions or skills automatically.
Reapplying setup refreshes only Friction-owned content and preserves unrelated
instructions. A setup preview ending in `noop` is already current; `create` or `update`
requires the matching `--apply` command. Repeat the preview/apply pair for Claude Code
or any other named adapter you use. For portable repository setup, run
`friction setup standard` from that repository. If you previously used a named
repository-level setup, run it from that repository with `--scope repo`. Start a new
agent session afterward so it loads the updated instructions and skills. Repeat the
update inside native Windows, WSL, containers, or remote agent runtimes separately when
you use them.

Global packages installed through nvm or another Node version manager belong to the
active Node installation. After switching Node versions, run `friction --version`; if
the command is missing, install the scoped package in that Node environment and verify
setup again with `friction doctor`.

### 2. Connect Friction to your coding agent

Setup has two steps: preview the exact plan, then apply it. The preview reports files,
capability coverage, readiness, and manual steps without making changes. Start with
`friction setup --list` to see the deterministic integration catalog.

Use `standard` for portable repository instructions, `skills` for the standalone
shared Agent Skills lifecycle, a named adapter for client-specific paths, or `generic`
for output-only guidance.

For Codex:

```sh
friction setup codex
friction setup codex --apply
```

For Claude Code:

```sh
friction setup claude-code
friction setup claude-code --apply
```

Run both pairs if you use both coding agents. Start a new coding-agent session after
setup so it reloads its instructions and skills.

For a portable repository setup that can be read by multiple compatible agents:

```sh
friction setup standard
friction setup standard --apply
```

The default user-level setup is the right choice when you work across several
repositories. For Codex, it uses the active `AGENTS.override.md` or `AGENTS.md` under
`CODEX_HOME` and installs the skills under your user home. Existing instructions remain
unchanged outside Friction's managed block.

Use repository-level setup only when you want Friction enabled in one particular
repository. From that repository, add `--scope repo` to both commands:

```sh
friction setup codex --scope repo
friction setup codex --scope repo --apply
```

Setup adds up to three things to the selected coding agent:

- a short instruction explaining when to record an observation;
- a `friction-review` skill for read-only analysis; and
- a `friction-fix` skill for explicitly authorized fixes.

On native Windows, Codex receives a PowerShell capture instruction with explicit no-BOM
UTF-8 handling. Claude Code receives its documented POSIX/Git Bash form. Portable
instructions include both POSIX and PowerShell forms. Setup preserves unrelated bytes,
supports a custom `CODEX_HOME` outside your user home, never edits a shell profile, and
never installs the CLI. Preview creates no files, directories, ACLs, locks, or private
store.

#### Integration status

| Integration | Setup model | Public status |
|---|---|---|
| Standard project | Repository `AGENTS.md` + `.agents/skills` | Project standard |
| Agent Skills | User, repository, or explicit workspace `.agents/skills` | Managed |
| Codex | Native user setup; portable repository setup | Managed |
| Claude Code | Native user or repository rules and skills | Managed |
| OpenCode | Native user or portable repository setup | Compatible, unverified |
| Pi | Native user or portable repository setup | Compatible, unverified |
| Warp | Manual user Global Rule; portable repository setup | Manual / Project standard |
| OpenClaw | Explicit workspace instructions and native skills | Workspace managed, under validation |
| Hermes | Explicit workspace with precedence-aware instructions and native skills | Workspace managed, under validation |
| Generic | Output-only source and shell guidance | Manual |

OpenCode and Hermes return a partial plan instead of creating `AGENTS.md` when doing so
would shadow an existing fallback instruction file. Warp user setup installs compatible
skills but gives you the exact Global Rule step to complete manually. OpenClaw and Hermes
require `--workspace PATH` and must be configured separately for every isolated
workspace and runtime.

```sh
friction setup opencode
friction setup pi --scope repo
friction setup warp
friction setup openclaw --workspace /path/to/agent-workspace
friction setup hermes --workspace /path/to/hermes-workspace
friction setup generic --source my-agent --shell portable
```

### 3. Work normally

You do not run Friction before starting your coding agent. There is no Friction
server, background process, or monitor. The setup persists, so after the one-time setup
you start your coding agent normally and give it normal coding tasks.

When the agent records an observation, it starts the `friction` command for that one
note. The command stores the note privately and exits immediately.

When the agent notices a concrete, avoidable obstacle, its Friction instruction tells it
to finish the immediate step, record a concise observation, and continue. Examples
include:

- a setup guide points to a command that no longer exists;
- unclear ownership forces the agent to search several modules before making a small
  change;
- a test or script reports success while producing misleading evidence;
- duplicated configuration requires the same change in unrelated places; or
- a hidden requirement causes a retry or workaround.

Friction is not meant to record progress updates, ordinary coding mistakes, style
preferences, full transcripts, secrets, or large command output.

### 4. Ask for a review

You decide when Friction has collected enough useful evidence to evaluate. There is no
required number of days or sessions. When you are ready, ask your coding agent to use
the installed review skill. For example:

```text
Use friction-review to review the Friction observations for this repository.
Verify the likely causes against the current code and tell me what is worth fixing first.
Do not change anything.
```

The review is read-only. It reports recurring patterns, distinguishes verified causes
from guesses, and recommends a priority. It does not modify code, configuration, or
observation status.

To review observations from every repository instead, say “across all repositories” in
your request.

### 5. Authorize one fix

Choose a verified problem from the review and name it explicitly. Include the observation
IDs from the review so the scope is unambiguous. For example:

```text
Use friction-fix to fix the verified “stale setup guide” problem from the review,
covering observations fr_0123456789abcdef0123456789abcdef and
fr_fedcba9876543210fedcba9876543210.
Change only that scope, verify the original failing path, and resolve only the
observations the fix actually addresses.
```

The fix skill inspects the current implementation, confirms the cause, makes the smallest
appropriate change, and verifies the result. If the cause cannot be confirmed, it should
report that uncertainty instead of guessing or closing the observations.

## See what Friction has recorded

Run these commands yourself whenever you want a direct view:

```sh
# Show open observations for the repository you are currently in
friction list

# Include resolved observations from every repository
friction list --status all --repo all

# Show counts and other structural facts without analyzing causes
friction stats --status all

# Check that storage, repository detection, setup, and the runtime are working
friction doctor
```

Human-readable `list`, `stats`, and `doctor` output uses structured sections and
automatically adds color in interactive terminals. Color is disabled for redirected or
piped output; set the standard `NO_COLOR` environment variable to turn it off explicitly.

Inside a Git repository, read commands use that repository by default. Outside Git, they
use all repositories. If Friction knows it is in a repository but cannot identify that
repository safely, it refuses the implicit read instead of showing unrelated private
records. You can still request `--repo all` explicitly.

For machine-readable output, add `--json`. Use `friction --help` or
`friction <command> --help` for the complete command options.

## Record an observation yourself

Agent setup handles normal capture. You can also record something manually.

On macOS, Linux, WSL, or Git Bash:

```sh
friction add --stdin --source manual <<'FRICTION_NOTE'
The setup guide used a removed command, which caused a failed first attempt.
FRICTION_NOTE
```

In native Windows PowerShell:

```powershell
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = $utf8NoBom
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom

@'
The setup guide used a removed command, which caused a failed first attempt.
'@ | friction add --stdin --source manual
```

Standard input keeps the observation out of Friction's command-line arguments and
process information. Text entered inline may still appear in your shell history or the
coding agent's transcript. A successful capture returns a receipt without repeating the
text you submitted.

## Keep observations private or share them deliberately

Your private Friction store holds the original records. Exports and repository copies do
not replace it. Ordinary capture never writes to the repository you are working in.

### Make a private export

`export` creates a private copy for your own use. It writes to the terminal unless you
choose a file:

```sh
friction export --status all
friction export --format jsonl --output ./friction-private.jsonl
```

An exported file is separate from Friction's store. Treat it as private and manage or
delete it yourself.

### Share selected observations with a repository

`publish` is the only Friction command that intentionally shares observations with a
repository. It writes only the fields intended for sharing and screens the text before
writing. Preview first, then apply.

Replace the example ID below with a complete ID from `friction list`:

```sh
friction publish fr_0123456789abcdef0123456789abcdef
friction publish fr_0123456789abcdef0123456789abcdef --apply
```

You can also publish every open observation belonging to the current repository:

```sh
friction publish --all-open
friction publish --all-open --apply
```

The default destination is `.friction/observations.jsonl` in the current repository.
Publishing does not move your private data, change observation status, or make the
repository copy the new source of truth.

## Undo setup or remove private observations

Setup removal is preview-first, like setup itself:

```sh
friction setup codex --undo
friction setup codex --undo --apply
```

Replace `codex` with the named adapter and matching scope you used. Friction removes
only content it owns and refuses to overwrite or delete content that changed
unexpectedly.

Codex, OpenCode, Pi, and Warp use shared `.agents/skills`. Their named undo removes
capture guidance but deliberately retains those skills so it cannot break another
compatible agent. Remove shared skills only through their explicit lifecycle:

```sh
friction setup skills --undo
friction setup skills --undo --apply
```

`standard`, Claude Code, OpenClaw, and Hermes own their installed skill copies and
include them in the matching undo plan.

To permanently remove one observation and its private history, preview the purge and then
apply it. Replace the example ID with a complete ID from `friction list`:

```sh
friction purge fr_0123456789abcdef0123456789abcdef
friction purge fr_0123456789abcdef0123456789abcdef --apply
```

Purge affects only Friction's private event files. It cannot remove copies you previously
exported, published, committed, backed up, or shared elsewhere.

## Privacy and control

Friction is designed to make its boundaries understandable:

- Observations are stored locally on your computer.
- There is no Friction account, cloud service, telemetry, continuously running process,
  automatic hook, transcript collection, or background review.
- The command-line program behaves predictably and does not contact an AI model. Your
  coding agent provides the reasoning only when you ask it to use a review or fix skill.
- Agent-authored text is limited in size and screened for high-confidence credential
  patterns before it is stored or shared.
- Secret screening reduces risk but is not a password vault or a guarantee that every
  possible secret format will be detected. Never intentionally submit secrets.
- Raw Git remote URLs, absolute repository paths, and internal repository keys are not
  included in exports or published records.
- Capture never changes your current repository.
- Setup, undo, publish, and purge make no changes unless you add `--apply`.
- Review is read-only. Fixing, sharing, and deletion require separate explicit requests.

Default private storage locations:

- Linux: `$XDG_DATA_HOME/friction` when `XDG_DATA_HOME` is set, otherwise
  `~/.local/share/friction`.
- macOS: `~/Library/Application Support/friction`.
- Native Windows: `%LOCALAPPDATA%\friction`.

Set `FRICTION_HOME` if you need a different location. For development and tests, always
point it at an isolated temporary directory rather than your live private store.

On native Windows, `FRICTION_HOME` must be a fully qualified path on a local volume. A
private UNC store, device path, drive-relative path, reparse path, or name Windows treats
as unsafe is rejected. The verified baseline is local NTFS. Before Friction persists
private bytes, it verifies an inheritance-protected ACL that grants access only to the
current user and LocalSystem; unverifiable or broadened ACLs fail closed. This protects
against ordinary cross-account access, not an administrator who can take ownership.

## Current limitations

This is an early `0.x` release. The command and stored-event contracts may still evolve
from dogfood evidence before a stable `1.0` release.

- Native Windows support is limited to Windows 11 x64 on local NTFS; Windows ARM64
  and private UNC storage are not claimed.
- It requires Node.js 24 or newer.
- It is designed for one developer and local storage; there are no teams or sync.
- It does not automatically understand or cluster observations. Review reasoning comes
  from the coding-agent session you explicitly invoke.
- It does not replace your repository's issue tracker.
- It has not been designed for private stores larger than roughly 10,000 events.

## Develop Friction

Use these commands when changing Friction itself:

```sh
npm ci
npm run check
npm run pack:smoke
npm run release:check
```

`npm run check` enforces the 300-line limit for code files, runs strict TypeScript
checks, executes the focused test suite, and builds the command-line program.

`npm run pack:smoke` creates a package in a temporary directory, installs it there, checks
the packaged instructions and skills, and verifies that capture and reading work across
separate processes without touching your normal Friction data.

`npm run release:check` runs the full check and packaged smoke together. The repository
uses npm for development and CI; pnpm is supported as a package runner and installer.

## License

Friction is available under the [MIT License](./LICENSE).
