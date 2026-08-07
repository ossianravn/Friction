# Fix policy

Requested scope is the deliverable. Prefer an executable guardrail, clear ownership, or
always-loaded guidance over a note that will be forgotten. Keep code files within the
repository's 300-line limit and do not introduce speculative architecture.

Use this sequence:

1. Inspect current code, docs, or configuration and trace callers, data flow, persistence,
   side effects, and meaningful failure paths.
2. Reproduce safely when practical and confirm the likely root cause.
3. Choose the narrowest stable owning boundary and reuse proven local patterns.
4. Implement only the scoped change.
5. Add or update a test only when it protects the durable contract in the observation.
6. Probe the opposite safety direction when loosening a gate or matcher.
7. Review the final diff and current behavior.

Do not use automatic subagent swarms, call models outside the active harness, generate
exhaustive tests, or claim certainty without inspected evidence.

If the verified owner is external, do not patch unrelated local code merely to close the
record. Draft a sanitized issue containing reproduction, expected and actual behavior,
impact, version, and workaround; show it to the user but never submit it automatically.
Leave the record open unless an authorized, verified local mitigation removes the
friction.
