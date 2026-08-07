# Verification and lifecycle policy

Verify with the original failing path or the closest meaningful production boundary.
State which boundaries were real, mocked, simulated, or unverified. A landed but
unverified change does not justify resolution, and disappearance alone is not proof.

Resolve all in-scope records truly covered by one verified fix, not just the newest.
Attach a concise verification string describing the evidence. Leave ambiguous or
differently caused records open. A review alone never resolves anything, and old records
must never be bulk-cleared as housekeeping.

Treat a reopened observation as regression evidence: the problem recurred or the prior
resolution was invalid. Recheck the current owner and prior verification before changing
it again.
