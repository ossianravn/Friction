# Private event storage and lifecycle

## Chosen storage model

Use a private one-file-per-event JSON store. Do not use SQLite, JSONL append logs, or a
single mutable index in the PoC.

Rationale:

- zero runtime dependency and no release-candidate database API;
- independent capture writes avoid a global append lock;
- immutable files fit the event model;
- atomic creation is straightforward;
- corruption is isolated to one event;
- PoC scans are acceptable below 10,000 events;
- migration to SQLite can be evaluated from measured scale later.

## Directory layout

```text
<FRICTION_HOME>/
  v1/
    events/
      <eventId>.json
    tmp/
      <random>.tmp
```

Do not add indexes, caches, lock databases, or backup directories during the PoC.
`doctor` may report ignored temporary files but must not delete them automatically.

## Serialized event format

- UTF-8 JSON with one trailing newline.
- Stable two-space indentation is allowed for inspectability; compact JSON is also
  acceptable if used consistently.
- Event files contain exactly one known event object.
- Unknown top-level properties are rejected by `doctor` but may be ignored by normal
  reads only when schema version remains `1` and required fields are valid.
- Unknown schema versions are not loaded into normal views and produce a warning.
- No comments or JSON5.

Use explicit runtime validation written for the small event union. Do not add a schema
library. Keep validation honest; do not cast parsed JSON directly to a domain type.

## Atomic event write

For every event:

1. Ensure private directories exist with required modes.
2. Serialize the already-screened event completely in memory.
3. Open a unique temp file inside the private `tmp` directory with exclusive create
   and mode `0600`.
4. Write the complete bytes, flush the file, and close it.
5. Atomically install the completed file at `events/<eventId>.json` without
   overwriting an existing event.
6. Remove the temp name.
7. Best-effort flush the containing directory where supported.
8. On an ID collision, remove the temp file, generate a new ID, and retry no more than
   twice.
9. On failure, return a safe error and never claim the event was recorded.

A same-filesystem hard link from the completed temp inode to the final exclusive path
is an acceptable no-overwrite primitive on macOS/Linux. Encapsulate the primitive in
`platform/fs.ts` and document the fallback if the runtime lacks it.

Never put unredacted text in the temp path or file.

## Concurrent capture guarantee

Eight concurrent `add` processes using the same empty `FRICTION_HOME` must create
eight intact observation events with no lost or partially parsed record.

This is the only required concurrency stress scenario. Do not build generalized
transaction or distributed locking infrastructure.

Simultaneous lifecycle changes to the same observation are not guaranteed. Folding is
deterministic by `(createdAt, eventId)`.

## Loading events

- Enumerate only regular files ending in `.json` under `v1/events`.
- Reject symlinked event files.
- Apply a conservative per-file size bound, such as 32 KiB, before reading.
- Parse and validate each event independently.
- Normal read commands skip corrupt/unknown events, include safe warning counts, and
  continue with valid records.
- `doctor` reports each corrupt path by filename and finding type, never body content.
- Sort validated events by `(createdAt, eventId)` before folding.

A missing store is a healthy empty state for read commands. `add` creates it.

## Lifecycle folding

1. Insert each observation by `observationId`.
2. Duplicate observation IDs are corruption; first valid event wins in normal reads
   and `doctor` reports the conflict.
3. Apply valid lifecycle events in sorted order.
4. A `resolved` event sets status to resolved and becomes the current resolution.
5. A `reopened` event sets status to open and clears the current resolution while
   retaining the last lifecycle event.
6. Orphan lifecycle events are ignored by normal reads with a warning and reported by
   `doctor`.
7. Unknown event types are ignored with a warning and reported by `doctor`.

## Resolve command behavior

`friction resolve ID`:

- requires one complete observation ID in the PoC; no prefix matching;
- verifies the observation exists in the folded corpus;
- if already resolved, returns idempotent success with `changed: false`;
- otherwise appends one `resolved` event;
- accepts optional screened `--note`, `--verification`, and `--source`; source defaults to `manual`;
- never rewrites the observation event;
- does not require a note, but the fix skill must supply concise verification.

## Reopen command behavior

`friction reopen ID`:

- verifies the observation exists;
- if already open, returns idempotent success with `changed: false`;
- otherwise appends one `reopened` event;
- accepts optional screened `--note` and `--source`; source defaults to `manual`;
- represents a regression or invalid prior resolution, not routine queue management.

## Purge command behavior

Purge is the emergency privacy escape hatch and the only destructive private-store
operation.

`friction purge ID`:

- previews by default and performs zero writes;
- reports the observation ID and number of matching event files, never their bodies;
- requires `--apply` to delete;
- deletes the observation event and every lifecycle event referencing it;
- refuses an unknown ID;
- aborts before deletion if any matching file cannot be validated safely;
- does not modify exports, repository projections, commits, or Git history;
- warns that already shared copies require manual cleanup.

Do not add bulk purge in the PoC.

## Doctor storage checks

Doctor reports:

- home path resolution;
- directory and event file permission warnings;
- unsupported symlinks;
- unreadable, oversized, malformed, or unknown-version events;
- duplicate observation IDs;
- orphan lifecycle events;
- leftover temp files;
- total valid event count;
- ability to create and remove a harmless probe file in `tmp`.

Doctor is read-mostly. The probe may write only inside the private temp directory and
must clean up. It never repairs or deletes findings.
