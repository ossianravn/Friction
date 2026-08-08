# Friction

Friction helps Codex and Claude Code remember what made your work harder—not only what
they finished.

Imagine that your coding agent completes a task, but only after it follows an outdated
guide, searches in the wrong place, and works around a misleading test command. The task
is done, so those problems usually disappear from view. The next agent can lose time to
the same problems again.

Friction gives your agent a private place to leave a short note when that happens. Later,
you can ask Codex or Claude Code to review those notes, find repeated problems, verify the
likely causes against the current code, and recommend what is worth fixing first.

Nothing is reviewed, changed, or shared in the background. You decide when review happens,
which fix is allowed, and whether any record should be added to a repository.

Friction is currently an unpublished proof of concept for one developer working across
one or more repositories.

## Platform status

| Environment | Status | Notes |
|---|---|---|
| macOS | Supported | Node.js 24. |
| Linux | Supported | Node.js 24. |
| Windows 11 x64 | Under validation | Native Node.js 24; Git for Windows for repository-aware behavior. |
| Windows Server 2025 x64 | CI target | The mandatory hosted-runner gate is not complete yet. |
| WSL | Supported through Linux behavior | Prefer the Linux filesystem for the project and private store. |
| Windows ARM64 | Not yet claimed | Requires its own complete native acceptance pass. |

The native Windows implementation now passes its private ACL, local-NTFS, npm command
shim, Git for Windows, and isolated Codex/Claude setup gates. The remaining CI and
end-to-end Windows 11 dogfood gates must pass before this README calls it supported.

## The workflow in plain language

1. You work with Codex or Claude Code as usual.
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
- npm; and
- Codex or Claude Code.

Friction is not published to npm yet. On macOS, Linux, WSL, or Git Bash, build and
install it from this repository with:

```sh
git clone https://github.com/ossianravn/Friction.git
cd Friction
npm ci
npm run build
npm pack
npm install --global ./friction-0.0.0.tgz
friction --version
```

In native Windows PowerShell, use:

```powershell
git clone https://github.com/ossianravn/Friction.git
Set-Location Friction
npm ci
npm run build
npm pack
npm install --global .\friction-0.0.0.tgz
friction --version
```

If you already have this repository, start with `npm ci`.

The global install matters because your coding agent needs a stable `friction` command on
`PATH`. Friction setup never installs the command for you.

### 2. Connect Friction to your coding agent

Setup has two steps: preview the exact plan, then apply it. The preview makes no changes.

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

By default, setup applies to your user account, so Friction is available across your
repositories. To enable it for only the repository you are currently in, add
`--scope repo` to both the preview and apply commands:

```sh
friction setup codex --scope repo
friction setup codex --scope repo --apply
```

Setup adds three things to the selected coding agent:

- a short instruction explaining when to record an observation;
- a `friction-review` skill for read-only analysis; and
- a `friction-fix` skill for explicitly authorized fixes.

On native Windows, Codex receives a PowerShell capture instruction with explicit
no-BOM UTF-8 handling. Claude Code receives the Git Bash form documented for native
Windows. Generic setup prints both labeled forms. Setup preserves CRLF in existing
Codex instructions, supports a custom `CODEX_HOME` outside your user home, never edits
a PowerShell or shell profile, and never installs the CLI. Preview creates no files,
directories, ACLs, locks, or private store.

### 3. Work normally

You do not need to start or monitor Friction. Continue giving Codex or Claude Code normal
coding tasks.

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

After Friction has collected observations, ask your coding agent to use the installed
review skill. For example:

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
printf '%s\n' "The setup guide used a removed command, which caused a failed first attempt." |
  friction add --stdin --source manual
```

In native Windows PowerShell:

```powershell
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
"The setup guide used a removed command, which caused a failed first attempt." |
  friction add --stdin --source manual
```

Standard input is preferred because it keeps the observation text out of your shell
history. A successful capture returns a receipt without repeating the text you submitted.

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

Replace `codex` with `claude-code` when needed. Friction removes only content it owns and
refuses to overwrite or delete content that changed unexpectedly.

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
- The command-line program behaves predictably and does not contact an AI model. Codex or
  Claude Code provides the reasoning only when you ask it to use a review or fix skill.
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

This is an unpublished proof of concept, not a polished public release.

- Native Windows 11 x64 remains under validation until its mandatory CI and dogfood
  gates pass; Windows ARM64 and private UNC storage are not claimed.
- It requires Node.js 24 or newer.
- It is designed for one developer and local storage; there are no teams or sync.
- It does not automatically understand or cluster observations. Review reasoning comes
  from the Codex or Claude Code session you explicitly invoke.
- It does not replace your repository's issue tracker.
- It has not been designed for private stores larger than roughly 10,000 events.

## Develop Friction

Use these commands when changing Friction itself:

```sh
npm ci
npm run check
npm run pack:smoke
```

`npm run check` enforces the 300-line limit for code files, runs strict TypeScript
checks, executes the focused test suite, and builds the command-line program.

`npm run pack:smoke` creates a package in a temporary directory, installs it there, checks
the packaged instructions and skills, and verifies that capture and reading work across
separate processes without touching your normal Friction data.
