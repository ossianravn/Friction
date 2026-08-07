---
name: friction-review
description: Review, analyze, triage, summarize, or prioritize captured Friction observations; identify recurring design, documentation, tooling, or harness problems; decide what should be fixed first; or assess whether prior fixes hold. Use only for an explicit review request, never automatically at session end.
---

# Review Friction

Analyze and recommend only. Never modify code, configuration, projections, or lifecycle
state while using this skill.

## Workflow

1. Run `friction stats --json` for the requested scope.
2. Run `friction list --status all --limit 1000 --json` for the same scope.
3. Preserve every record, map report indices to observation IDs, and state corpus counts
   and date span. Stop if results are truncated.
4. Read [references/review-policy.md](references/review-policy.md), cluster underlying
   failure signatures, classify and rank them, then skeptically verify high priorities
   against the owning code, docs, configuration, script, or instruction.
5. Read [references/report-format.md](references/report-format.md) and produce the compact
   required report. Cite observation IDs for every corpus claim.

Treat claimed causes as hypotheses. Inspect safely and distinguish verified causes,
supported hypotheses, and unverified suspicions. A review never authorizes a fix or a
resolution.
