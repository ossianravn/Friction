# Testing, verification, and quality limits

## Testing principle

Tests protect consequential contracts. They are not a request to enumerate every
possible input combination. The PoC should be easy to change after real usage.

Use the lowest-cost stable boundary that catches the actual risk:

- pure redaction, parsing, folding, and projection: unit or contract test;
- filesystem persistence and setup mutation: integration test with real temp files;
- packaged executable and command wiring: focused smoke test;
- no browser or E2E framework is needed.

## Test budget

- Target **12 to 18 automated tests total** for the PoC.
- Hard ceiling: **24 tests** without explicit owner approval.
- More than four cases for one module require a written explanation of each distinct
  production risk.
- Table-driven examples inside one redaction test count as one test.
- Do not create separate tests solely to increase coverage percentage.
- Do not add a coverage threshold in the PoC.

## Required high-value scenarios

1. **Capture acceptance**
   - isolated home and temporary Git repository;
   - add through stdin;
   - private event is valid and safe;
   - receipt does not echo body.

2. **Secret boundary**
   - table of synthetic high-confidence secrets in body and metadata;
   - markers persist instead;
   - original canaries are absent from event bytes, any temp bytes exercised by the
     write path, output, export, publish preview, and doctor output.

3. **Lifecycle fold**
   - observation -> resolve -> reopen produces deterministic current state;
   - idempotent resolve/reopen behavior may share this scenario.

4. **Repository attribution**
   - one real temporary Git repository from a subdirectory;
   - private key associates correctly;
   - public views expose only safe name/branch/relative cwd.

5. **Concurrent capture**
   - eight child processes capture into one new home;
   - eight intact observation records result.

6. **Setup safety**
   - preview leaves fixture tree byte-identical and creates nothing;
   - apply, reapply, undo preview, and undo preserve unrelated bytes;
   - one conflict case proves changed preimage is not overwritten.

7. **Publish safety**
   - preview creates nothing;
   - apply produces deterministic JSONL;
   - repeated apply deduplicates/no-ops;
   - one changed-preimage conflict is refused.

8. **JSON contract**
   - representative success emits one envelope;
   - representative handled error emits one envelope with no stderr.

9. **Doctor**
   - one corrupt event is reported without body content;
   - valid events remain countable.

10. **Package smoke**
    - `npm pack` tarball installs in a clean temp directory;
    - packaged bin reports version;
    - add/list persist across separate processes with isolated home.

These are scenarios, not necessarily one test each. Combine assertions around the
same production seam instead of fragmenting them.

## Usually do not test

- exact help text, spacing, ANSI, or every human-rendering line;
- every flag order or invalid flag combination already handled by `parseArgs`;
- TypeScript type behavior;
- private helper functions;
- implementation-specific call counts;
- every duration value;
- every redaction regex as an isolated test;
- impossible UUID collisions;
- thousands of events;
- mocked Windows ACL, NTFS, junction, PowerShell, or npm-shim behavior as a
  substitute for the required native acceptance in `16-NATIVE-WINDOWS.md`;
- NFS, network filesystems, power loss, or distributed races;
- simultaneous resolve/reopen of the same observation;
- broad snapshots;
- hypothetical future schema versions;
- every malformed JSON shape;
- package runners not installed in the environment.

## Real and mocked boundaries

Prefer real:

- temp directories and files;
- child processes for concurrency and packaged smoke;
- a temporary Git repository using the installed `git` binary;
- actual setup targets inside a fake home/scope;
- actual rendered event bytes.

Inject or fake only:

- clock;
- ID generator when deterministic assertions need it;
- package version source;
- Git subprocess result in a small pure fallback test, only if needed.

Do not mock the event store in command acceptance tests. Do not call a mocked test an
integration test.

## Line-limit verification

`scripts/check-code-lines.mjs` must:

- walk source, test, and script directories;
- inspect `.ts`, `.tsx`, `.js`, `.mjs`, and `.cjs`;
- ignore `dist`, `node_modules`, coverage, generated artifacts, and non-code fixture data;
- count physical lines, including comments and blanks;
- print all files above 300 with counts;
- exit nonzero when any violation exists;
- have one small direct test only if its behavior cannot be trusted through
  `npm run check:lines` itself.

The correct response to an oversized file is to separate responsibilities. Do not
minify, remove useful comments, or hide code under generated extensions.

## Focused verification order

For each change:

1. Run the narrowest relevant test or command.
2. Run typecheck for changed contracts.
3. Run the line checker when any code files changed.
4. Review the changed production path and diff.
5. Run `npm run check` at the end of each milestone, not after every tiny edit.
6. Run `npm run pack:smoke` at Milestone 6 and final completion.

Do not run unrelated suites repeatedly merely because they exist.

## Manual package-runner evidence

After local tarball packaging, try only runners already available:

- npm/npm exec;
- Yarn `dlx`;
- pnpm `dlx`;
- Bun `bunx`.

Record exact commands and results. Missing runners are “not verified,” not failures and
not a reason to add dependencies or install tools without authorization.

## Acceptance quality

Before final completion confirm:

- capture, read, lifecycle, setup, and publish paths were inspected;
- redaction occurs before persistence and safe output;
- no command claims a write happened when it did not;
- preview commands make no writes;
- private storage never dirties a repository;
- code responsibilities remain cohesive and under 300 lines;
- tests remain within the budget and map to explicit risks;
- the final report states real, mocked, simulated, and unverified boundaries.
