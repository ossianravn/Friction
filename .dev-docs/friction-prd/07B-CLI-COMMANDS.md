# CLI command surface

The foundation, envelopes, and error behavior are owned by
`07A-CLI-FOUNDATIONS.md`.

## `add`

```text
friction add TEXT
friction add --stdin
  [--source manual|codex|claude-code|generic]
  [--model MODEL]
  [--area AREA]
  [--impact IMPACT ...]
```

Rules:

- exactly one positional text or `--stdin`;
- read stdin only to the body byte limit plus one byte;
- source defaults to `manual`;
- installed adapters pass source explicitly;
- normalize repeated impacts to unique values in declaration order;
- success never echoes body;
- repository attribution failure is a warning, not a capture failure;
- redaction or event-write failure means no success receipt.

JSON data:

```ts
{
  observationId: string;
  createdAt: string;
  source: Source;
  repository: { name: string } | null;
  redactionCount: number;
}
```

## `list`

```text
friction list
  [--repo current|all]
  [--since 30m|12h|7d]
  [--limit 1..1000]
  [--status open|resolved|all]
```

Defaults:

- inside Git: current repository;
- outside Git: all repositories;
- status open;
- limit 50;
- newest first by `(createdAt, observationId)` descending.

`--repo current` outside a recognized repository is exit 3. Empty matches are exit 0.
Human output includes screened body and safe context. JSON omits repository key,
absolute paths, and internal event metadata.

Public JSON record:

```ts
type PublicObservationRecord = {
  observationId: string; createdAt: string; body: string; source: Source;
  model: string | null; area: Area | null; impacts: Impact[];
  repository: { name: string; branch: string | null; cwdRelative: string } | null;
  status: "open" | "resolved";
  resolution: { createdAt: string; note: string | null; verification: string | null } | null;
  redactionCount: number;
};
```

## `stats`

```text
friction stats [same scope/since/status filters as list]
```

Report structural facts only:

- total and first/last timestamps;
- counts by day, source, repository display name, area, impact, and status;
- redacted-record count and total replacements;
- exact repeated screened bodies with counts.

Do not infer themes, root causes, priority, or semantic clusters in the CLI.

JSON data contains `scope`, `total`, `firstAt`, `lastAt`, maps named `byDay`,
`bySource`, `byRepository`, `byArea`, `byImpact`, and `byStatus`, plus
`redactedRecordCount`, `replacementCount`, and `exactRepeats: {body,count}[]`.

## `resolve` and `reopen`

```text
friction resolve ID
  [--note TEXT]
  [--verification TEXT]
  [--source SOURCE]

friction reopen ID
  [--note TEXT]
  [--source SOURCE]
```

Return:

```ts
{
  observationId: string;
  changed: boolean;
  status: "open" | "resolved";
  lifecycleEventId: string | null;
}
```

Already-in-state calls are successful no-ops. Accept one full observation ID only.
Lifecycle storage behavior is owned by `06-STORAGE-AND-LIFECYCLE.md`.

## `export` and `publish`

The exact contracts, write safety, and projection shapes are owned by
`08-PUBLISH-AND-EXPORT.md`.

## `purge`

The exact preview/apply and deletion contract is owned by
`06-STORAGE-AND-LIFECYCLE.md`.

## `setup`

The exact adapter and safe-mutation contract is owned by
`09-SETUP-AND-HARNESSES.md`.

## `doctor`

```text
friction doctor
```

Return ordered checks:

```ts
type DoctorCheck = {
  name: string;
  status: "ok" | "warn" | "error";
  message: string;
};
```

Check:

- runtime and CLI version;
- resolved private home and permissions;
- event health and writable temp probe;
- current repository attribution when applicable;
- PATH discoverability;
- Codex and Claude setup state.

Never print record bodies, raw remotes, environment values, or instruction contents.
Exit 0 when no error checks exist; exit 1 when any error check exists. Warnings alone
remain exit 0.

## Scope resolution

Commands using `--repo` share one policy:

1. Discover the current safe repository context.
2. Inside Git, default to `current`; outside Git, default to `all`.
3. `current` matches the private repository key, not display name.
4. `--repo current` without a safe current key is `not_found`.
5. Never guess from the current directory basename alone.

## Filter order

For read commands:

1. Load and fold all valid private events.
2. Resolve repository scope.
3. Apply status.
4. Apply `since` against observation creation time.
5. Sort using the command’s normative order.
6. Apply limit last.
7. Report returned count and total-before-limit so review can detect truncation.

The JSON list data must therefore include:

```ts
{
  scope: ScopeDisplay;
  records: PublicObservationRecord[];
  count: number;
  total: number;
  truncated: boolean;
}
```

## Human-output guidance

- Optimize for scanning, not decoration.
- Show observation ID, time, area/impacts when present, safe repository context, body,
  and lifecycle state.
- Do not add spinners, progress bars, interactive paging, or color dependencies.
- Long operations may finish silently until the result; the PoC corpus should be
  small.
