---
name: friction-fix
description: Fix, address, resolve, or remediate explicitly named Friction observations or a named reviewed cluster. Use only when the user explicitly authorizes that exact fix scope; do not use a review request as authorization to change anything.
license: MIT
compatibility: Requires the friction CLI on PATH and permission to read and append to its private local store.
---

# Fix Friction

Change only the explicitly named observation or cluster. Read
[references/fix-policy.md](references/fix-policy.md) before editing and
[references/verification-policy.md](references/verification-policy.md) before resolving
records.

## Workflow

1. Load the exact observations in scope.
2. Trace the current owning production path and reproduce safely when practical.
3. Confirm the cause; if it is unverified, investigate and report instead of guessing.
4. Make the smallest root fix at the boundary that owns the invariant, reusing nearby
   proven patterns.
5. Verify the original failing path or closest meaningful equivalent and review the diff.
6. Resolve every in-scope record truly addressed by the verified fix with a concise
   verification string. Leave ambiguous or differently caused records open and explain
   why.

Do not fix adjacent clusters, resolve unrelated records, submit upstream issues, commit,
publish, or change global configuration without separate authorization.
