# CLI foundation and machine contract

## General contract

Binary name: `friction`.

Every command supports:

```text
--help
--version
--json
```

Human output is concise and may use plain text but no mandatory color. JSON mode emits
exactly one versioned object followed by one newline and no ANSI or extra prose.
Handled JSON-mode errors also go to stdout with stderr empty. Human-mode errors go to
stderr.

Do not call `process.exit` from services. The CLI runner maps one result to output and
an exit code.

## Envelope shapes

Success:

```json
{"version":1,"ok":true,"command":"add","data":{},"warnings":[]}
```

Handled error:

```json
{"version":1,"ok":false,"command":"setup","error":{"code":"setup_conflict","message":"Setup target changed before apply.","retryable":false},"warnings":[]}
```

Do not include stack traces, arbitrary exception messages, submitted bodies, raw Git
context, or existing configuration contents in handled envelopes.

## Exit codes

```text
0  success, empty result, or idempotent no-op
1  unexpected internal or I/O failure
2  usage or validation error
3  requested observation or current repository not found
4  setup, export, purge, or publish precondition conflict
5  temporary store contention; reserved for future use
6  safety or redaction failure; nothing persisted
```

Use a fixed error registry. Suggested codes:

```text
internal_error
io_error
invalid_input
not_found
setup_conflict
output_conflict
publish_conflict
safety_failure
unsupported_platform
corrupt_store
```

Map each code to one stable safe message, exit code, and retryability. A caught unknown
exception maps to `internal_error`; expose no raw exception payload.

## `schema`

```text
friction schema
```

Print a versioned JSON description regardless of `--json`:

- contract version and CLI version;
- command and flag inventory;
- read-only, appending, destructive, and repository-writing annotations;
- enums and byte limits;
- event and materialized record shapes;
- error and exit-code dictionary;
- supported environment variables.

This is the agent self-orientation surface. Generate it from small canonical constants
where practical, but do not build a general schema framework.

## Help and version

- `friction --help` lists commands and one-line purposes.
- `friction <command> --help` lists that command’s syntax and important rules.
- Help and version are the only unwrapped stdout exceptions.
- Do not test exact whitespace or every help line. One packaged smoke is enough.

## Output stability

- Sort arrays deterministically when order is part of the contract.
- Never rely on filesystem enumeration order.
- Use RFC 3339 UTC timestamps with milliseconds.
- Human output may improve during dogfood; JSON version 1 is the durable contract.
- A breaking JSON change requires contract version 2, not hidden drift.
- Empty query results are successful and explicit.
- Warnings are safe, structured, and never contain rejected input or raw exceptions.

## Parser ownership

Use `node:util.parseArgs` behind one CLI parsing boundary.

- Each command defines only its real PoC options.
- Normalize repeated options after parsing.
- Reject unknown options and extra positionals.
- Services receive validated command input rather than raw argv.
- Do not add aliases unless users are likely to guess them and they cost no contract
  ambiguity.
- Do not use interactive prompts or launch an editor.

## Duration parsing

Support only:

```text
<number>m
<number>h
<number>d
```

Require a positive integer with no spaces and bound it to 365 days. Convert relative
to an injected clock. Do not add RFC timestamps, weeks, months, or natural language in
the PoC.
