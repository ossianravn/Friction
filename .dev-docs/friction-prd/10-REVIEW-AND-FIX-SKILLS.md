# Explicit review and remediation skills

## Separation of responsibilities

Ship two skills for both Codex and Claude Code:

- `friction-review`: analyze and recommend; never modify code or lifecycle state.
- `friction-fix`: fix only the explicitly requested cluster or observation set, verify
  it, then resolve exactly the addressed records.

Do not merge them into one skill. A review request is not authorization to change the
repository.

The CLI remains model-free. The active coding harness performs reasoning through the
skill and calls the deterministic CLI for corpus data and lifecycle changes.

## Skill asset structure

```text
skills/friction-review/
  SKILL.md
  references/
    report-format.md
    review-policy.md

skills/friction-fix/
  SKILL.md
  references/
    fix-policy.md
    verification-policy.md
```

Keep each skill concise enough to load usefully. Move stable detailed formats into
references. Do not add executable helper scripts unless dogfood proves repeated
manual processing is a problem.

## `friction-review` triggers

Use when the user asks to:

- review, analyze, triage, summarize, or prioritize friction;
- identify what is slowing agents down;
- inspect recurring design, docs, tooling, or harness problems;
- decide what should be fixed first;
- determine whether prior fixes appear to hold.

Do not invoke automatically at session end.

## Review workflow

### Phase 1: establish corpus ground truth

1. Run scoped `friction stats --json`.
2. Run `friction list --status all --limit 1000 --json` for the same scope.
3. Preserve every record and assign a report index referencing its observation ID.
4. State active/resolved counts and date span.
5. If the result is truncated, stop and report the limitation; do not pretend the
   sample is complete.

### Phase 2: cluster failure signatures

Cluster by the underlying observed mechanism, not merely area or repository name.
Examples:

- stale setup guide points to removed command;
- validation ownership is split across two layers;
- workspace test wrapper uses a surprising cwd;
- gate returns success with an empty, misleading result;
- local feature requires broad edits because policy is duplicated.

Do not discard repeated records. For each signature calculate:

- encounter count;
- distinct days;
- first and last encounter;
- distinct repositories;
- impact mix;
- open/resolved mix.

### Phase 3: classify and rank

Classify signatures as:

- **false evidence**: plausible wrong output or silent success that can corrupt a
  decision;
- **visible friction**: clear failure, retry, search, workaround, delay, or confusion.

False evidence outranks visible friction regardless of raw count.

Within each class, use this qualitative priority model:

```text
recurrence × day span × repository spread × consequential impact
with recency as a tiebreaker
```

Do not produce fake numeric precision. Explain the deciding factors and name the
runner-up when choosing one “worst” cluster.

### Phase 4: skeptic verification

For every high-priority cluster:

- treat the observation’s claimed cause as a hypothesis;
- inspect the actual code, docs, config, guide, script, or instruction it blames;
- reproduce safely when practical;
- search other observations for the same symptom under another diagnosis;
- distinguish verified cause, supported hypothesis, and unverified suspicion;
- check whether the problem has already been fixed after the last observation;
- cite observation IDs for every corpus claim.

A review may inspect production files but must not modify them.

### Phase 5: report

Required sections:

1. Scope and corpus health.
2. Repository overview table.
3. Failure-signature table.
4. False-evidence findings.
5. Highest-leverage recommendations.
6. Verification status and refuted/downgraded hypotheses.
7. Proposed observation IDs per recommended fix.
8. What remains unknown or unreviewed.

Prefer a short ranked report over an exhaustive narrative. Do not reproduce full
observation bodies when a concise paraphrase and IDs suffice.

## `friction-fix` authorization

Use only when the user explicitly asks to fix, address, resolve, or remediate a named
observation or cluster.

- Requested scope is the deliverable.
- Do not fix adjacent clusters merely because review found them.
- Do not resolve records outside the verified fix scope.
- Do not submit upstream issues, make commits, publish projections, or change global
  configuration without separate authorization.

## Fix workflow

1. Load the exact observations in scope.
2. Inspect the current owning code/docs/config and trace the production path.
3. Reproduce the reported effect safely when practical.
4. Confirm the likely root cause; downgrade the task to investigation when unverified.
5. Choose the smallest root fix at the boundary that actually owns the invariant.
6. Prefer executable guardrails, clear ownership, or always-loaded guidance over a
   note nobody will revisit.
7. Reuse nearby proven patterns rather than create a new mechanism.
8. Implement only the scoped change, keeping code files within 300 lines.
9. Verify with the original failing path or the closest meaningful equivalent.
10. Add or update a test only when it protects the durable contract named by the
    observation.
11. Probe the opposite safety direction when loosening a gate or matcher.
12. Review the diff and current behavior.
13. Resolve every in-scope observation addressed by the verified fix, with a concise
    verification string.
14. Leave ambiguous or differently caused records open and say why.

## Lifecycle truthfulness

- A review alone never resolves anything.
- A landed but unverified change does not justify resolution.
- “It stopped appearing” is not proof of a fix.
- Resolve all records truly covered by one verified fix, not only the newest.
- Reopen means the problem recurred or the prior resolution was invalid; treat it as
  regression evidence.
- Never bulk-clear old observations as housekeeping.

## Upstream problems

When the verified owner is an external dependency or harness:

- do not patch unrelated local code merely to close the observation;
- produce a sanitized issue draft with reproduction, expected/actual behavior, impact,
  version, and workaround;
- show it to the user;
- never submit automatically;
- leave the observation open unless a verified local mitigation actually removes the
  user’s friction and the user asked to resolve it.

## Skill quality bar

The skills must reinforce simplicity:

- no automatic subagent swarm;
- no mandatory exhaustive tool timeline;
- no model call outside the active harness;
- no speculative architecture redesign;
- no exhaustive test generation;
- no claim of certainty without inspected evidence.
