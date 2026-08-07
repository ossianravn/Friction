# Product, user, and PoC scope

## Product statement

Friction is a personal, local-first feedback loop between a developer and coding
agents. It gives an agent a low-cost way to record avoidable friction while working,
then provides explicit workflows to review the accumulated signal, fix verified root
causes, and confirm whether those fixes hold.

The product is not merely an error log. It must also surface counterproductive
codebase design, unclear ownership, stale guidance, misleading abstractions, hidden
invariants, duplicated knowledge, and workflows that force unnecessary work.

## Primary user

The PoC serves one developer who uses Codex as the main coding agent and Claude Code
as a secondary agent across multiple repositories.

The user wants:

- one private cross-project inbox;
- capture from any project or harness through a normal shell command;
- no working-tree changes during ordinary capture;
- evidence of recurring problems rather than polished session summaries;
- explicit review and remediation, not automatic autonomous cleanup;
- safe selective sharing into a repository when a record should travel with the code.

Teams are a later product phase. Do not model organizations, users, roles, remote
stores, or synchronization in the PoC.

## Problem

Agents optimize for task completion. They often discard the path cost: retries,
dead-end searches, misleading output, outdated docs, counterproductive design, and
manual workarounds. The final answer says what succeeded while the repository loses
information about what made success unnecessarily difficult.

Without a durable capture point:

- the same agent repeats the same mistake in a later session;
- a different agent encounters the same trap with no prior warning;
- stale docs and guides remain trusted because nobody reports the mismatch;
- design debt is noticed as local inconvenience rather than a repeated system cost;
- tool output that is plausible but wrong can corrupt later decisions;
- the developer has no recurrence data for deciding what to improve first.

## Product outcome

Every meaningful group of agent sessions should make the user’s environment,
repositories, instructions, or tools easier for future sessions without materially
slowing the current task.

The PoC succeeds when it proves this loop:

1. An agent notices concrete avoidable friction.
2. It records one concise observation and continues working.
3. The user explicitly reviews a corpus of observations.
4. Review separates symptoms from verified causes and ranks recurring problems.
5. An explicitly requested fix changes the owning boundary and verifies the result.
6. Addressed observations are resolved; recurrence can reopen them as regressions.
7. Selected sanitized observations can be published into a repository deliberately.

## In-scope friction

Capture friction involving:

- codebase design and architecture;
- unclear ownership or responsibility boundaries;
- abstractions that create more work than they remove;
- a local change requiring broad cross-cutting edits without a real domain reason;
- hidden or conflicting invariants;
- duplicated configuration or knowledge;
- surprising coupling, layering, or control flow;
- stale, contradictory, incomplete, or outdated docs and guides;
- commands, scripts, tests, configuration, dependencies, or environment setup;
- harness limitations, dead-end tool calls, broken links, and misleading errors;
- plausible wrong output or silent success that creates false evidence;
- repeated manual workarounds and avoidable searching or backtracking.

## Out-of-scope records

Do not record:

- accomplishments or progress updates;
- ordinary implementation mistakes with no missing guardrail or misleading system;
- known tracked bugs that belong in the project’s issue workflow;
- subjective style preferences without a concrete task cost;
- speculative redesign wishes unsupported by an observed workflow;
- secrets, raw transcripts, environment dumps, large output, or private reasoning;
- a failure of the Friction capture command itself.

An ordinary mistake becomes valid friction only when it reveals a repeatable missing
guardrail, stale instruction, misleading interface, or counterproductive design.

## PoC feature set

- model-free TypeScript CLI with stable human and JSON output;
- private user-local append-only event store;
- capture, list, stats, export, resolve, reopen, purge, doctor, and schema commands;
- safe repository attribution without storing raw remote URLs;
- high-confidence secret redaction before persistence;
- preview-first setup for Codex and Claude Code plus a generic snippet;
- explicit review and fix skills for Codex and Claude Code;
- explicit sanitized repository projection through `publish`;
- npm package shape with a `friction` binary usable by package runners;
- dogfood measurement guidance.

## PoC non-goals

- teams, sharing service, hosted database, cloud sync, dashboard, or telemetry;
- automatic transcript review or background capture;
- automatic semantic analysis in the CLI;
- automatic fixes or issue submission;
- a replacement for the project issue tracker;
- complete secret detection or security-vault guarantees;
- complete Windows support;
- compatibility with every historical Node version;
- performance optimization for corpora above 10,000 events;
- polished public release, package publication, or marketing site.

## Product principles

1. **Primary task first.** Capture must be quick and non-blocking.
2. **Observed cost over opinion.** Record what happened and its effect.
3. **Private by default.** Sharing requires a separate explicit action.
4. **Structure without ceremony.** The body is the only required authored field.
5. **Recurrence is signal.** Preserve repeats across sessions.
6. **Causes are hypotheses.** Verify before changing code or resolving records.
7. **Root fixes over reminders.** Prefer the owning executable boundary when known.
8. **User controls action.** Review, fixing, publishing, and purging are explicit.
9. **Model-free core.** The active harness supplies intelligence when a skill is run.
10. **Learn from usage.** Defer complexity until dogfood data justifies it.

## PoC success measures

During dogfood, seek evidence that:

- useful observations are captured without interrupting normal work;
- noise remains below 25 percent;
- recurring design, docs, and tooling problems become visible;
- review produces a materially better action list than reading raw records;
- at least several verified root fixes prevent recurrence;
- private storage and setup do not create working-tree or configuration surprises;
- the product’s own friction is visible through normal errors and dogfood notes rather
  than recursively logged.
