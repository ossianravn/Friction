# Friction — Codex implementation PRD

Status: implementation-ready proof-of-concept specification  
Product name: **Friction**  
Repository and CLI name: `friction`

## Purpose of this bundle

This bundle instructs Codex to build a new TypeScript repository for a personal,
local-first agent friction system. The product lets coding agents record concrete
workflow and codebase friction without interrupting their main task, then gives the
user explicit review and fix workflows that turn recurring observations into durable
improvements.

The name is intentionally plain. “Friction” describes the signal being captured
without a mascot, metaphor, or novelty label. Do not rename the product during the
PoC.

## Required reading order

1. `00-CODEX-HANDOFF.md`
2. `01-PRODUCT-AND-SCOPE.md`
3. `02-RESEARCH-SYNTHESIS.md`
4. `03-ARCHITECTURE-AND-REPO.md`
5. `04-DOMAIN-AND-CAPTURE.md`
6. `05-SECURITY-AND-REPOSITORY.md`
7. `06-STORAGE-AND-LIFECYCLE.md`
8. `07A-CLI-FOUNDATIONS.md`
9. `07B-CLI-COMMANDS.md`
10. `08-PUBLISH-AND-EXPORT.md`
11. `09-SETUP-AND-HARNESSES.md`
12. `10-REVIEW-AND-FIX-SKILLS.md`
13. `11-TESTING-AND-QUALITY.md`
14. `12-IMPLEMENTATION-PLAN.md`
15. `13-DOGFOOD-AND-ITERATION.md`

Read the entire bundle before changing files. Later documents refine earlier ones.
When two passages appear to conflict, use the narrower responsibility document and
record the interpretation in the implementation plan before coding.

## Responsibility map

| Responsibility | Owning PRD |
|---|---|
| Product outcome, user, scope, non-goals | `01` |
| Prior-art lessons and deliberate omissions | `02` |
| Toolchain, modules, repository layout, file limits | `03` |
| Observation meaning, taxonomy, event contracts | `04` |
| Redaction, privacy, safe repository attribution | `05` |
| Local store, folding, resolve/reopen/purge | `06` |
| CLI envelopes, errors, parser, schema | `07A` |
| CLI command behavior and shared filtering | `07B` |
| Private exports and explicit repo projection | `08` |
| Codex, Claude Code, and generic setup | `09` |
| Review and remediation skills | `10` |
| Test budget and release evidence | `11` |
| Ordered implementation milestones | `12` |
| Dogfood measurements and post-PoC decisions | `13` |

## Non-negotiable limits

- This is a single-package TypeScript modular monolith, not a monorepo.
- The private user-local event store is canonical.
- Repository publication is explicit, sanitized, and preview-first.
- The core CLI performs no model calls and needs no API key.
- No code file may exceed **300 physical lines**, including tests and scripts.
- Do not compress formatting or split files mechanically to satisfy the limit.
- Keep every module cohesive and give each side effect one clear owner.
- Use the test budget in `11-TESTING-AND-QUALITY.md`; do not enumerate imaginary
  edge cases.
- Do not add teams, cloud sync, dashboards, hooks, or transcript mining during the
  PoC.

## Completion definition

The PoC is complete only when the milestone acceptance criteria are met, the package
can be installed from a local tarball, Codex and Claude Code can be configured safely,
observations can be captured from any repository, private records can be reviewed and
resolved, selected records can be projected into a repository, and the exact checks
run are reported honestly.

`LINE_COUNTS.txt` records the validated line count of every document in this bundle.
No PRD document exceeds 220 lines.
