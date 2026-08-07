# Prior-art synthesis and chosen decisions

## Sources reviewed

The implementation must preserve the strongest ideas from these projects without
copying their product assumptions wholesale:

- `pi-vent`:
  <https://github.com/IgorWarzocha/howaboua-pi-stuff/tree/main/packages/pi-vent>
- `agent-friction-skill` and its maintained successor:
  <https://github.com/aurorascharff/agent-friction-skill>
  <https://github.com/aurorascharff/skills/tree/main/skills/friction-log>
- `treygoff24/papercuts`:
  <https://github.com/treygoff24/papercuts>
- `claylevering/papercuts`:
  <https://github.com/claylevering/papercuts>

Also use current official Codex, Claude Code, Node.js, npm, Yarn, pnpm, and Bun
behavior when implementing setup and packaging. Do not rely on remembered paths or
old blog posts when an official source exists.

The originating workflow contributes two product truths: capture must be cheap enough
to happen in the moment, and the queue is valuable only when a later agent is asked to
fix the accumulated problems. Friction preserves both while replacing a loose
repository Markdown file with a safer personal-first lifecycle.

## `pi-vent`: trigger discipline

Keep:

- clear exclusion of routine lint failures, one-off mistakes, and normal debugging;
- emphasis on repeated or systemic friction;
- record the failure, repeated workaround, and useful preventative fix;
- never use friction logging as a substitute for finishing the task;
- batch closely related observations instead of constant tool chatter.

Adapt:

- Do not require every issue to occur twice. A first occurrence can be severe,
  misleading, or broadly systemic.
- Capture once per distinct issue per task by default. A second same-task record is
  valid only when it adds new evidence, impact, or a meaningfully different path.
- Store structured private events instead of appending a repository Markdown file.

Reject for the PoC:

- a harness-specific native tool as the only entry point;
- one repository-local `VENT.md` as the canonical store;
- returning the full observation in a success UI.

## Aurora’s friction log: diagnostic quality

Keep for explicit review:

- separate what was expected, what occurred, what was tried, and what resolved it;
- treat stale docs, missing docs, training-data fallbacks, timeouts, and false paths as
  meaningful DX evidence;
- distinguish documentation work, framework/tooling work, and research questions;
- require concrete action items for important verified friction;
- cap repeated attempts rather than brute-forcing the same failed command;
- record source provenance when making a consequential diagnosis.

Adapt:

- The ambient capture path stays concise. Rich expected/actual/resolution analysis is
  reconstructed during explicit review from records and the current codebase.
- Source provenance belongs in the review report, not as a required field on every
  capture.

Reject for the PoC:

- a full per-task Markdown report during ordinary coding;
- mandatory tool timelines, prompt copies, full logs, or build-time accounting;
- automatic end-of-session transcript scanning. The source project itself retired
  the passive version as insufficiently reliable.

## Trey’s CLI: deterministic machine contract

Keep:

- shell CLI as the universal harness boundary;
- stable versioned JSON envelopes and exit codes;
- a self-describing `schema` command;
- `doctor` as diagnosis rather than silent repair;
- immutable observations and lifecycle events rather than rewriting history;
- bounded input and deterministic rendered views;
- empty lists as successful empty state, not errors;
- capture concurrency as a real requirement.

Adapt:

- Use a private user-local canonical store instead of committed-by-default JSONL.
- Store safe relative repository context, never raw absolute paths in shared output.
- Redact the observation body before persistence, not only optional evidence.
- Use one file per event to avoid a shared append lock in the initial TypeScript PoC.

Reject for the PoC:

- committed-by-default free-form records;
- raw absolute `cwd` and repository paths in shareable records;
- rich evidence flags for stderr and command output;
- complex content-addressed IDs and torn-line recovery needed by a shared JSONL log.

## Clay’s CLI and review skill: privacy and closed loop

Keep:

- personal, local-first default;
- stdin for agent-authored observations;
- success output that never echoes the submitted body;
- redaction before persistence;
- private data-directory permissions;
- preview-first, reversible, idempotent setup;
- adapter-owned files or uniquely managed blocks that preserve unrelated content;
- explicit resolve and reopen lifecycle;
- recurrence tables, failure-signature clustering, and a skeptic pass;
- false evidence outranking visible friction;
- fix at the root and resolve only after verification.

Adapt:

- Use Node.js and a simple event directory instead of Bun and SQLite for the PoC.
- Keep repeated observations across sessions, while suppressing same-task duplicate
  chatter through instructions rather than hidden deduplication.
- Split pure review from explicit fixing so analysis never implies authorization to
  modify code.

Reject for the PoC:

- automatic semantic clustering in the CLI;
- requiring Bun or macOS;
- a large up-front migration and database test matrix;
- treating every encounter in one task as useful volume regardless of duplicate cost.

## Resulting Friction design

Friction combines four layers:

1. **Low-noise capture discipline** from `pi-vent`.
2. **Diagnostic vocabulary** from Aurora’s explicit friction investigation.
3. **Stable agent-facing CLI contract** from Trey’s implementation.
4. **Private setup, redaction, and skeptical remediation loop** from Clay’s work.

The deliberate simplifications are equally important:

- no model client in the CLI;
- no transcript mining;
- no raw evidence attachments;
- no database in the PoC;
- no automatic fixes;
- no team model;
- no continuous background process;
- no dual-write between private and repository stores.

## Decision rule for future additions

A prior-art feature is not automatically authorized because it exists elsewhere.
After the PoC, add a feature only when dogfood identifies a concrete recurring
failure that the feature would remove and the user accepts its privacy, complexity,
and maintenance cost.
