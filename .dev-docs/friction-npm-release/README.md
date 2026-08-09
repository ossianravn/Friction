# npm release plan and handoff

- **Updated:** 2026-08-09 Europe/Copenhagen
- **Target:** `@ossianravn/friction@0.1.0`
- **License:** MIT
- **Development package manager:** npm
- **Additional consumption target:** pnpm
- **Registry state:** not published

## Decision

The owner approved preparing Friction for a first public npm release under the existing
`ossianravn` user scope. The unscoped `friction` name is owned by another npm user, so
the package uses `@ossianravn/friction` while preserving the executable name
`friction`.

The repository keeps npm, `package-lock.json`, and the existing npm CI contract. pnpm
support means users can install or run the same registry package with pnpm; it does not
introduce a second lockfile or package-manager-specific production path.

## Progress

| Gate | State | Evidence or next action |
|---|---|---|
| R0 — decision and name | Complete | Scoped name, `0.1.0`, MIT, npm-first, and pnpm interoperability approved. |
| R1 — release metadata and docs | Complete | Scoped metadata, MIT license, README, workflow, version, and PRD contract updated. |
| R2 — package verification | Complete | npm checks, dry-run, npm/pnpm consumption, tarball audit, and native Windows artifact pass completed. |
| R3 — first publish | Ready for release PR | Authentication and dry-run pass; commit, CI, and final publish approval remain. |
| R4 — trusted publisher | Pending after first publish | Bind `release.yml` to GitHub Actions in npm package settings. |

## Verification evidence

WSL release preparation used Node `24.14.0`, npm `11.9.0`, and the already-available
pnpm `9.0.0`:

```text
npm run check:lines
# passed: 103 code files checked, 300-line maximum

npm run typecheck
# passed

npm run release:check
# passed: 14 tests, 1 expected native-Windows skip, build and package smoke passed

npm_config_dry_run=true npm run pack:smoke
# passed

npm publish --dry-run --access public --json
# passed: @ossianravn/friction@0.1.0, public access, latest tag, no registry write
```

The authenticated final-gate recheck on 2026-08-09 used the same Node and npm
versions. `npm whoami` returned `ossianravn`; the registry returned `E404` for
`@ossianravn/friction@0.1.0`; `npm run release:check` passed; and a fresh
`npm publish --dry-run --access public --json` reproduced the exact package metadata
below without a registry write.

The first publish dry-run exposed and then verified a release-path fix. npm propagates
its dry-run configuration to nested npm commands, which initially suppressed the
temporary `npm pack` inside package smoke. The smoke environment now explicitly makes
that one isolated nested pack real while the outer registry operation remains a dry
run. The direct inherited-dry-run regression command above passes.

Self-review also found `scripts/pack-smoke.mjs` at 269 lines. Its generic child-process
and npm runner moved to the focused `scripts/package-smoke-process.mjs`; the two files
are now 199 and 80 lines, respectively, and the complete release/dry-run gates pass
after the split.

Exact package evidence:

```text
filename: ossianravn-friction-0.1.0.tgz
packed size: 56,780 bytes
unpacked size: 230,215 bytes
entries: 99
integrity: sha512-+k/Kg1K9gNDwsxspl0VJ26jHKQzQf2iOTNDSS+29xZheQ733sv8O/phmNKAigvw0Vbx8qZo5cxXxPTpq+a0Q4w==
```

The tarball contains only `LICENSE`, `README.md`, `assets`, `dist`, `package.json`, and
`skills`. It contains no source, tests, scripts, internal docs, workflows, lockfile,
`.npmrc`, developer-specific root path, bundled dependency, or runtime dependency.

The exact tarball returned `0.1.0` through:

- isolated `npm exec`;
- isolated global npm installation;
- isolated `pnpm dlx`;
- the exact shim created by isolated `pnpm add --global`.

pnpm `9.0.0` printed a local-tarball “has no binaries” warning during global install,
but created `/tmp/.../pnpm-home/friction`. Direct execution of that isolated shim
returned `0.1.0`; the result did not rely on the older ambient global installation.

The same tarball was copied to an isolated native-Windows test root and installed with
Node `24.19.0` and npm `11.17.0`. The real Windows package shim reported `0.1.0`, a
synthetic Unicode observation round-tripped through capture/list, and doctor passed
with the real ACL-backed private store and zero error checks.

Real boundaries: WSL build/tests/package runners and native Windows npm shim, Unicode,
filesystem, private-store ACL, capture, list, and doctor. Mocked or simulated release
boundaries: none. Current-change macOS and full native-Windows source-suite CI remain
unverified until the release candidate is committed and pushed; the preceding
cross-platform candidate commit remains green.

## First-publication gate

Do not publish merely because release preparation passes. Current gate state:

- complete: the worktree was reviewed; `.dev-docs/context/` is a pre-existing
  untracked session handoff and is outside the release-change set;
- complete: `@ossianravn/friction@0.1.0` is absent from the registry;
- complete: WSL npm authentication resolves to `ossianravn`;
- pending: release branch commit, push, pull request, and green current-change CI;
- pending after green CI: final explicit owner approval for the irreversible version publication;
- pending after approval: publish, verify registry metadata, and install the published
  version in an isolated prefix.

Publication sequence:

1. Confirm the worktree contains only the intended release changes plus separately
   identified user-owned files.
2. Confirm `@ossianravn/friction@0.1.0` still does not exist in the registry.
3. Obtain final explicit owner approval for the irreversible version publication.
4. Run `npm login` interactively in the chosen environment and verify
   `npm whoami` returns `ossianravn`.
5. Run `npm publish --access public` from the verified release candidate.
6. Verify the registry metadata and install the published version in an isolated
   prefix before changing any live installation.

WSL is now npm-authenticated for the manual first publication. Native Windows remains
separate and does not need registry authentication for this release path. Never print,
copy, or commit npm tokens or the contents of an authenticated `.npmrc`.

## Subsequent releases

After the first package exists, configure npm trusted publishing with:

- provider: GitHub Actions;
- GitHub owner: `ossianravn`;
- repository: `Friction`;
- workflow: `release.yml`;
- environment: `npm`;
- allowed action: `npm publish`.

Configure required reviewers on the GitHub `npm` environment, then keep long-lived
write tokens out of repository secrets. The workflow is manual-only, runs the complete
release check once through `prepublishOnly`, and publishes through npm's short-lived
OpenID Connect credential.

## Required verification record

Record exact results here before requesting final publish approval:

- Node and npm versions;
- `npm run release:check`;
- `npm publish --dry-run --access public`;
- packed filename, size, integrity, and complete file-category audit;
- isolated npm install and npm exec;
- isolated pnpm global install and pnpm dlx;
- real, mocked, simulated, skipped, and unverified boundaries;
- final `git diff --check`, file line counts, and worktree state.
