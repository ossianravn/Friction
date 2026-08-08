# Domain contracts and capture policy

## Canonical nouns

- **Observation**: one concrete encounter with avoidable friction.
- **Lifecycle event**: a resolution or reopening applied to an observation.
- **Corpus**: the user’s private set of observations and lifecycle events.
- **Projection**: selected safe records written into a repository by `publish`.
- **Failure signature**: a review-time cluster representing the same underlying
  mechanism. It is not stored by the core CLI.

Do not use “ticket,” “issue,” or “bug” as the canonical domain noun. Friction can be
valid without being a product bug.

## Capture threshold

Record an observation when a concrete system, repository, instruction, design, or
tooling property causes at least one of these effects:

- retry;
- backtrack;
- workaround;
- extra search or documentation lookup;
- blocked progress;
- plausible but wrong evidence;
- an avoidably slow path;
- uncertainty about the correct owning boundary.

A first occurrence is enough when the effect is meaningful. Recurrence controls
priority later; it is not an admission gate.

## Design-friction guidance

The installed instructions must explicitly include codebase design. Good design
observations name a task cost, for example:

- a local policy change required edits in five unrelated modules because ownership is
  scattered;
- two abstractions both claim responsibility for validation;
- a hidden invariant is enforced only by caller convention;
- a helper conceals an important side effect and caused an incorrect assumption;
- a repository guide describes a superseded architecture;
- a boundary forces agents to duplicate knowledge already available to the owner;
- a “generic” layer requires more special cases than direct domain code;
- a misleading success status produced a wrong conclusion.

Do not record “this architecture is bad” without the observed task and consequence.
Do not prescribe a redesign during capture unless the prevention is obvious; the
review workflow verifies causes and chooses action.

## Same-task recurrence rule

- Record each encounter once.
- Record a recurrence when the same friction causes another concrete retry,
  workaround, delay, or wrong conclusion, including later in the same task.
- Do not create another record merely by restating the same incident.
- Do not silently deduplicate across tasks or days. Repeated later encounters are the
  recurrence signal.
- The PoC has no task ID or cooldown mechanism. This is instruction policy, not hidden
  storage logic.

## Authored input

The body is the only required user- or agent-authored field.

Body rules:

- one or two sentences are encouraged but not enforced;
- normalize CRLF to LF and trim outer whitespace;
- reject empty input and NUL bytes;
- limit to 4,096 UTF-8 bytes before redaction;
- describe `what was being done -> observed obstacle and cost -> useful workaround`;
- state observed facts first; a cause or prevention is suspected unless verified;
- do not accept both positional text and `--stdin`;
- installed agent guidance uses literal-safe stdin so text avoids process argv;
- inline shell text may still appear in shell history or the harness transcript.

## Optional capture fields

`source` enum:

```text
manual | codex | claude-code | generic
```

- Source defaults to `manual` when omitted.
- Setup adapters pass the source explicitly.

`model`:

- optional string;
- maximum 128 UTF-8 bytes before redaction;
- never infer it through environment scraping.

`area` enum:

```text
design | docs | tooling | configuration | tests | dependency |
harness | environment | workflow | other
```

`impact` is repeatable with unique values from:

```text
retry | backtrack | workaround | extra-search | blocked |
false-evidence | slow-path | unclear-owner
```

Do not require area or impact. The agent should omit a field rather than guess.
Tags are not included in the PoC; area and impact are enough.

Metadata byte bounds before redaction:

- repository name: 255 bytes;
- branch: 512 bytes;
- relative working directory: 2,048 bytes;
- normalized remote preimage: 4,096 bytes.

Reject or omit unsafe overlong repository context rather than truncating it silently.

## Observation event contract

```ts
type ObservationEvent = {
  schemaVersion: 1;
  eventType: "observation";
  eventId: string;          // evt_<compact UUID>
  observationId: string;    // fr_<compact UUID>
  createdAt: string;        // RFC 3339 UTC with milliseconds
  body: ScreenedText;
  source: "manual" | "codex" | "claude-code" | "generic";
  model: ScreenedText | null;
  area: Area | null;
  impacts: Impact[];
  repository: RepositoryContext | null;
  redaction: {
    rulesetVersion: 1;
    replacementCount: number;
  };
  clientVersion: string;
};
```

`eventId` and `observationId` are separate even though the initial observation owns
one event. Lifecycle events need their own IDs and point to `observationId`.

Compact UUID means UUIDv4 without dashes. Do not design content-addressed IDs in the
PoC. Collision handling is: generate a new ID if an event path already exists.

## Lifecycle event contracts

```ts
type ResolvedEvent = {
  schemaVersion: 1;
  eventType: "resolved";
  eventId: string;
  observationId: string;
  createdAt: string;
  actor: Source;
  note: ScreenedText | null;          // <= 2,048 bytes before redaction
  verification: ScreenedText | null;  // <= 512 bytes before redaction
  redaction: RedactionMetadata;
  clientVersion: string;
};

type ReopenedEvent = {
  schemaVersion: 1;
  eventType: "reopened";
  eventId: string;
  observationId: string;
  createdAt: string;
  actor: Source;
  note: ScreenedText | null;
  redaction: RedactionMetadata;
  clientVersion: string;
};
```

Resolution verification is concise evidence such as the original command now passing
or the stale guide being corrected and checked. It is not raw output.

## Materialized record

Folding produces:

```ts
type ObservationRecord = {
  observation: ObservationEvent;
  status: "open" | "resolved";
  resolution: ResolvedEvent | null;
  lastLifecycleEvent: ResolvedEvent | ReopenedEvent | null;
};
```

Sort lifecycle events by `(createdAt, eventId)` and let the last valid event determine
status. This gives deterministic behavior. Simultaneous resolve/reopen of the same
observation is not a PoC concurrency guarantee.

## Capture receipt

Successful `add` output may include:

- observation ID;
- creation time;
- source;
- safe repository display name or null;
- redaction replacement count;
- warnings such as unavailable Git attribution.

It must never include the submitted body, raw repository key, absolute paths, remote
URL, model, or hidden diagnostic payload.

## Capture failure behavior

The CLI returns a clear nonzero error. Installed instructions tell the agent to
continue the primary task and not record the Friction failure as another observation.
There is no silent success fallback and no alternate unsafe store.
