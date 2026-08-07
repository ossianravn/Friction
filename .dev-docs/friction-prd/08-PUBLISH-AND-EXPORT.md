# Private export and explicit repository projection

## The hybrid boundary

The private user-local event store is the only canonical store. A repository file is
an explicit sanitized projection for collaboration or portability.

Do not:

- write repository files during `add`;
- dual-write private and repository stores;
- treat a projection as synchronization state;
- import repository projections back into the private corpus in the PoC;
- update local lifecycle because a projection changed;
- modify `.gitignore`, `.gitattributes`, or repository instructions during publish.

## Private `export`

```text
friction export
  [--repo current|all]
  [--since DURATION]
  [--status open|resolved|all]
  [--format markdown|jsonl]
  [--output FILE]
  [--force]
```

Defaults:

- same repository/status defaults as `list`;
- Markdown format;
- stdout output and no file write.

Export contains screened bodies and safe display context. It omits:

- repository key;
- absolute paths;
- Git common directory;
- raw remote;
- internal event filenames;
- any discarded or unredacted preimage.

Markdown is deterministic and inert:

- fixed section order;
- records sorted oldest first for readable history;
- body in fenced blocks using a fence length that cannot be broken by body backticks;
- no raw HTML generation;
- lifecycle and verification shown only when present.

JSONL contains one projected materialized record per line with a trailing newline.

## Export file safety

When `--output` is present:

1. Resolve the user-supplied path without changing current working directory.
2. Refuse an existing path unless `--force` is present.
3. Reject directories, symlinks, and non-regular existing targets.
4. Serialize output before mutation.
5. Write an exclusive same-directory temp file.
6. Flush and atomically rename.
7. Preserve no hidden backup.
8. In JSON mode, return the output path and record count; return `markdown/jsonl: null`.

Without `--output`, JSON mode may return the rendered content inline because export is
an explicit read request.

## Repository `publish`

```text
friction publish ID [ID ...]
friction publish --all-open
  [--output .friction/observations.jsonl]
  [--apply]
```

Rules:

- exactly one or more IDs, or `--all-open`, never both;
- default output is `.friction/observations.jsonl` under the current Git worktree root;
- require a current Git repository;
- preview is the default and performs literally zero writes;
- `--apply` is required for mutation;
- full observation IDs only;
- selected records may be open or resolved; `--all-open` selects open only;
- publication is explicit sharing, so the preview names IDs and safe summaries;
- do not publish an unknown, corrupt, or repository-mismatched observation silently.

By default, an observation must belong to the current repository key. Add no
cross-repository override in the PoC.

## Projection record

```ts
type PublishedObservation = {
  schemaVersion: 1;
  observationId: string;
  createdAt: string;
  status: "open" | "resolved";
  body: string;
  source: Source;
  model: string | null;
  area: Area | null;
  impacts: Impact[];
  repository: {
    name: string;
    branch: string | null;
    cwdRelative: string;
  };
  resolution: null | {
    createdAt: string;
    note: string | null;
    verification: string | null;
  };
  redactionCount: number;
};
```

Omit repository key, commit SHA, absolute paths, event IDs, actor internals, and client
version. Every value is already screened; project again through a strict allowlist.

## Publish merge behavior

1. Read the existing target only if it exists.
2. Reject symlinked or non-regular targets.
3. Parse every non-empty JSONL line as projection schema version 1.
4. Reject malformed, duplicate-ID-with-different-payload, or unknown-version content.
5. Merge selected records by `observationId`, replacing the same ID with the current
   private projection.
6. Preserve valid existing records not selected.
7. Sort all records by `(createdAt, observationId)` ascending.
8. Serialize one compact JSON object per line with a trailing newline.
9. Preview reports creates, updates, unchanged count, target, and selected IDs.
10. Apply rechecks the target digest immediately before atomic replacement.
11. A changed preimage is `publish_conflict`; do not overwrite.

Repeated apply with no private-state change is a successful no-op.

## Publish atomicity and scope

- Canonicalize the worktree root.
- Reject any output path escaping the worktree.
- Walk existing path components with `lstat`; reject symlinked parents and target.
- Create `.friction` only on apply, never preview.
- New directory mode follows normal repository permissions, not private `0700`.
- Write a same-directory exclusive temp file, flush, rename, and flush directory where
  supported.
- Preserve existing regular-file mode on replacement; use `0644` for a new projection.

## Purge interaction

Purge deletes only private events. It must warn that exports, projections, commits,
backups, and copied files are separate. The CLI does not search repositories or Git
history for published data.

## Team-phase boundary

The projection format is a useful seed for future team workflows, but the PoC does
not define merge policy, ownership, server sync, issue creation, or conflict
resolution across branches. Do not add those assumptions to version 1.
