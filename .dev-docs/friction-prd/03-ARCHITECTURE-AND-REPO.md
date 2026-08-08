# Architecture, toolchain, and repository ownership

## Chosen architecture

Build a single-package TypeScript modular monolith. The CLI is the product boundary.
Internal modules have explicit ownership, but there is no workspace, package graph,
plugin framework, service container, or public SDK in the PoC.

The main capture flow is:

```text
argv or stdin
  -> command parsing
  -> input validation
  -> redaction of every user-controlled string
  -> safe repository attribution
  -> immutable event construction
  -> private atomic event write
  -> safe receipt without body text
```

The read flow is:

```text
scope and filters
  -> load event files
  -> validate and fold lifecycle
  -> filter and sort
  -> human or versioned JSON rendering
```

The repository publication flow is separate:

```text
explicit IDs or --all-open
  -> load folded private records
  -> project safe fields
  -> preview
  -> atomic repository write only with --apply
```

## Runtime and package decisions

- Node.js 24 LTS.
- npm as the development package manager.
- ESM through `"type": "module"`.
- strict TypeScript.
- Initial `package.json` name: `friction`.
- Initial version: `0.0.0`.
- Set `private: true`; do not publish or add a license during implementation.
- Expose a package binary named `friction` at `dist/bin/friction.js`.
- Add a Node engine requirement of `>=24`.
- Use `node:util.parseArgs`; do not add a CLI framework.
- Use `node:test` with `tsx` for TypeScript tests.
- Build with `tsc`.

Authorized development dependencies:

- `typescript`
- `tsx`
- `@types/node`

Runtime dependencies should remain zero. Do not add a dependency merely to save a
small amount of straightforward boundary code. Stop and report before adding any
production dependency.

## Required scripts

```text
npm run typecheck
npm test
npm run build
npm run check:lines
npm run check
npm run pack:smoke
```

Expected composition:

- `typecheck`: `tsc --noEmit`.
- `test`: Node test runner with TypeScript loading.
- `build`: compile to `dist/`.
- `check:lines`: enforce the 300-line production code limit.
- `check`: line check, typecheck, focused test suite, then build.
- `pack:smoke`: create a tarball, install it in a temporary directory, and run the
  packaged `friction --version` and one isolated capture/read smoke flow.

Do not add a formatter or linter during Milestone 0. Add `.editorconfig`, use the
TypeScript compiler and review, and reconsider tooling only after the core is stable.

## Repository layout

```text
package.json
package-lock.json
tsconfig.json
tsconfig.build.json
.editorconfig
.gitignore
README.md
assets/
  instructions/
    capture-shared.md
    capture-posix.md
    capture-powershell.md
skills/
  friction-review/
    SKILL.md
    references/
  friction-fix/
    SKILL.md
    references/
scripts/
  check-code-lines.mjs
  pack-smoke.mjs
src/
  bin/
    friction.ts
  cli/
    parse.ts
    run.ts
    output.ts
    errors.ts
    commands/
  domain/
    events.ts
    filters.ts
    scope.ts
  capture/
    service.ts
    input.ts
  security/
    redact.ts
    screened-text.ts
  repository/
    discover.ts
    remote.ts
    identity.ts
  storage/
    paths.ts
    event-store.ts
    load-events.ts
  lifecycle/
    fold.ts
    service.ts
  views/
    list.ts
    stats.ts
    export.ts
  publish/
    project.ts
    service.ts
  setup/
    plan.ts
    apply.ts
    adapters/
  doctor/
    checks.ts
  platform/
    clock.ts
    ids.ts
    fs.ts
    git.ts
test/
  acceptance/
  fixtures/
  support/
```

This is a suggested ownership map, not permission to create every file immediately.
Create modules only when their milestone needs them. Keep command handlers thin and
put policy in the owning domain module.

## Module responsibilities

- `bin`: shebang and one call into the CLI runner.
- `cli`: parse arguments, route commands, map known errors, render output.
- `domain`: event and filter contracts with no filesystem or process access.
- `capture`: validate capture input and orchestrate the write path.
- `security`: pure screening and redaction; no persistence or Git access.
- `repository`: collect and sanitize Git context; no event writes.
- `storage`: own data paths, permissions, atomic event I/O, and event validation.
- `lifecycle`: fold current state and append resolve/reopen events.
- `views`: deterministic list, stats, and export projections.
- `publish`: explicit safe repository projection only.
- `setup`: preview/apply/undo plans and harness-specific targets.
- `doctor`: read-only health checks; never print bodies.
- `platform`: narrow wrappers for time, IDs, filesystem primitives, and subprocesses.

## Dependency direction

- Domain types import nothing from side-effect modules.
- Security may import domain brands/types, never storage.
- Storage persists validated domain events, never renders CLI output.
- Command handlers call services and renderers; services never call `process.exit`.
- Setup and publish may use platform filesystem helpers but do not reach through the
  event store’s private internals.
- Skills are shipped text assets, not imported application code.

Avoid barrels that hide ownership. Import directly from the owning module unless a
small intentional public boundary improves clarity.

## Code-size and cohesion rules

- Hard maximum: 300 physical lines per code file, including tests and scripts.
- Begin splitting at roughly 250 lines when a second responsibility is visible.
- A command file should own one command or a tightly coupled command pair.
- A file should not combine parsing, storage, and rendering.
- Do not create “utils.ts” as a dumping ground.
- Do not use generated code to evade the line checker.
- Exclude `dist`, `node_modules`, coverage, generated artifacts, and non-code fixture
  data from the checker. Do not exempt test code.
- The checker itself must report every offending path and line count, then exit 1.

## Public surface

The PoC public surface is the executable and shipped skill/instruction assets. Do not
export internal classes or promise a library API. Keep package `exports` absent unless
needed for the bin. This preserves freedom to change internals after dogfood.
