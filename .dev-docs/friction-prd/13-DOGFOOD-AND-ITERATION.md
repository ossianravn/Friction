# Dogfood, measurements, and deferred decisions

## Purpose

The PoC is an instrument for learning. Do not pre-build features that dogfood can
validate or reject more cheaply. The first useful release should make capture safe,
review actionable, and remediation honest.

## Initial dogfood period

Run for ten working days across:

- 25 to 40 substantive coding-agent sessions;
- two or three real repositories with different shapes;
- Codex as the primary harness;
- Claude Code in enough sessions to compare capture behavior;
- both repository subdirectories and repository roots;
- at least one review every five to ten sessions;
- several explicitly requested fixes from reviewed clusters.

Do not enable hooks or transcript mining during this baseline. First measure what
persistent instructions plus the CLI capture naturally.

## What to measure

Track manually or through structural CLI stats where possible:

- sessions with at least one useful observation;
- useful observations per session;
- obvious friction the agent failed to capture;
- noise: ordinary mistakes, vague opinions, accomplishments, or duplicates;
- exact repeat count across sessions;
- same-task duplicate chatter;
- counts by area and impact;
- design and stale-doc observations specifically;
- redaction events and any sensitive-data near miss;
- capture command failures;
- Codex versus Claude capture differences;
- review time and whether the report changed prioritization;
- number of clusters verified, refuted, or left uncertain;
- time from first observation to verified fix;
- records resolved per verified fix;
- recurrence after resolution;
- publish usage and whether projections were actually valuable.

Do not add telemetry. A local dogfood notes file outside production storage is enough.

## Review questions after the period

1. Did observations reveal problems the final task reports would have hidden?
2. Did design and documentation friction produce concrete root fixes?
3. Was capture frequent enough without becoming narration overhead?
4. Were areas/impacts useful, or did agents guess them badly?
5. Did private cross-project storage feel better than repository-local capture?
6. Did users actually run review, or did the corpus become a write-only inbox?
7. Did false-evidence classification surface higher-risk problems?
8. Were causes often wrong until the skeptic pass?
9. Did resolve/reopen states remain trustworthy?
10. Was explicit publication useful enough to justify future team work?

## Decision thresholds

Treat these as hypotheses, not permanent metrics:

- Noise above 25 percent: tighten capture wording before adding automation.
- Obvious capture recall consistently poor: prototype a limited deterministic hook
  candidate buffer, still requiring explicit promotion.
- Frequent same-task duplicates: consider an explicit task/session key or short
  cooldown after studying real patterns.
- Review rarely run: improve surfacing or cadence before adding richer capture.
- Causes frequently wrong: make observation language more neutral and strengthen
  skeptic verification.
- More than 10,000 events or materially slow scans: evaluate SQLite with measured
  query needs and a migration plan.
- Publish rarely used: postpone team mode instead of expanding projection features.
- Published JSONL conflicts in real collaboration: study merge strategy before adding
  a server or lock protocol.

## Features deferred until evidence

### Team phase

- organization or workspace model;
- shared remote corpus;
- roles, permissions, ownership, and audit;
- synchronization and branch conflict policy;
- issue tracker integration;
- shared dashboards and trend views.

### Capture automation

- Codex or Claude hooks;
- automatic tool-failure candidates;
- transcript mining;
- background daemon;
- session IDs and implicit deduplication;
- IDE extension or MCP server.

### Analysis

- embeddings and semantic index;
- automatic cluster persistence;
- model API integration;
- cross-user scoring;
- estimated minutes lost;
- autonomous prioritization or fixes.

### Distribution and platform

- public npm publication;
- scoped package name selection;
- Homebrew or standalone native binary;
- automatic updater;
- Windows ARM64, private UNC storage, or native installer support;
- signed releases and release automation.

## Principles for iteration

- Fix the product’s own observed friction through the same evidence standard.
- Prefer changing instructions or one owning boundary before adding infrastructure.
- Do not preserve a PoC contract that dogfood proves harmful solely because tests
  encode it; update the PRD and contract deliberately.
- Keep private data compatibility in mind before changing stored event schema.
- Add one feature for one demonstrated recurring problem, then measure again.
- Continue enforcing 300-line code files and proportional testing as the product
  grows.

## PoC decision review deliverable

At the end of dogfood, produce a concise decision document containing:

- corpus summary and noise/recall assessment;
- top five verified failure signatures;
- fixes completed and recurrence status;
- privacy or setup incidents;
- which deferred feature, if any, now has evidence;
- whether to retain event files or evaluate SQLite;
- whether to begin a team phase;
- the smallest next iteration and explicit non-goals.

Do not interpret “successful PoC” as authorization to implement every deferred item.
