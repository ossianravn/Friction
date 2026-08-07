# Review policy

## Cluster and measure

Cluster by the observed mechanism, not merely area or repository name. Preserve repeated
records. For each signature, report encounter count, distinct days, first and last
encounter, distinct repositories, impact mix, and open/resolved mix.

## Classify and rank

Classify each signature as either:

- **False evidence:** plausible wrong output or silent success that could corrupt a
  decision.
- **Visible friction:** clear failure, retry, search, workaround, delay, or confusion.

False evidence outranks visible friction regardless of count. Within each class, reason
qualitatively from recurrence, day span, repository spread, and consequential impact;
use recency only as a tiebreaker. Do not invent numeric precision. When naming one worst
cluster, explain the deciding factors and name the runner-up.

## Verify skeptically

For each high-priority cluster:

1. Treat the recorded cause as a hypothesis.
2. Inspect the actual owning artifact and reproduce safely when practical.
3. Search the corpus for the same symptom with a different diagnosis.
4. Classify the cause as verified, supported, or unverified.
5. Check whether a later change already fixed it.
6. Cite the relevant observation IDs.

Inspect only. Do not modify files or lifecycle state. Do not use an automatic subagent
swarm, call a model outside the active harness, produce an exhaustive tool timeline,
speculate about redesigns, generate exhaustive tests, or claim certainty without
inspected evidence.
