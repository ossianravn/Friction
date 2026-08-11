import assert from "node:assert/strict";
import test from "node:test";

import { humanRenderOptions } from "../../src/cli/presentation.js";
import { renderDoctor } from "../../src/views/doctor.js";
import { renderList, type ListData } from "../../src/views/list.js";
import { renderStats, type StatsData } from "../../src/views/stats.js";

const escapeSequence = /\u001b\[/u;

test("human output is structured and color follows terminal conventions", () => {
  const listData: ListData = {
    scope: { repo: "all" },
    records: [
      {
        observationId: `fr_${"a".repeat(32)}`,
        createdAt: "2026-08-10T22:12:22.436Z",
        body:
          "A sandbox boundary caused a retry while validating a change, and the workaround required a second command because the first result looked successful.",
        source: "codex",
        model: null,
        area: "tooling",
        impacts: ["retry", "slow-path"],
        repository: {
          name: "friction",
          branch: "main",
          cwdRelative: ".",
        },
        status: "open",
        resolution: null,
        redactionCount: 0,
      },
      {
        observationId: `fr_${"b".repeat(32)}`,
        createdAt: "2026-08-09T10:00:00.000Z",
        body: "An older observation was resolved.",
        source: "manual",
        model: null,
        area: null,
        impacts: [],
        repository: null,
        status: "resolved",
        resolution: {
          createdAt: "2026-08-10T10:00:00.000Z",
          note: null,
          verification: null,
        },
        redactionCount: 0,
      },
    ],
    count: 2,
    total: 2,
    truncated: false,
  };

  const interactive = humanRenderOptions(
    { isTTY: true, columns: 100 },
    {},
  );
  const colored = renderList(listData, interactive);
  assert.deepEqual(interactive, { color: true, columns: 100 });
  assert.match(colored, escapeSequence);
  const plain = renderList(listData, { ...interactive, color: false });
  assert.match(plain, /Friction observations/u);
  assert.match(
    plain,
    new RegExp(`● OPEN · 2026-08-10 22:12 UTC · fr_${"a".repeat(32)}`, "u"),
  );
  assert.match(plain, /✓ RESOLVED/u);
  assert.match(
    plain,
    /  repo friction:\. · branch main · area tooling · impact retry, slow-path/u,
  );
  assert.match(plain, /  │ A sandbox boundary caused a retry/u);
  assert.match(plain, /End · 2 observations · all repositories/u);
  assert.equal(plain.includes("unclassified"), false);
  assert.equal(plain.includes("impacts: none"), false);

  for (const columns of [80, 120, 200]) {
    const width = Math.min(96, columns - 1);
    const responsive = renderList(listData, { color: false, columns });
    const bodyLines = responsive
      .split("\n")
      .filter((line) => line.startsWith("  │ "));
    assert.equal(responsive.includes("─".repeat(width)), true);
    assert.equal(bodyLines.length >= 3, true);
    assert.equal(
      bodyLines.every((line) => Array.from(line).length <= width),
      true,
    );
  }

  const noColor = humanRenderOptions(
    { isTTY: true, columns: 80 },
    { NO_COLOR: "" },
  );
  assert.equal(noColor.color, false);
  assert.doesNotMatch(renderList(listData, noColor), escapeSequence);

  const piped = humanRenderOptions({ isTTY: false }, {});
  assert.deepEqual(piped, { color: false, columns: null });

  const statsData: StatsData = {
    scope: { repo: "all" },
    total: 2,
    firstAt: "2026-08-09T10:00:00.000Z",
    lastAt: "2026-08-10T22:12:22.436Z",
    byDay: { "2026-08-09": 1, "2026-08-10": 1 },
    bySource: { codex: 1, manual: 1 },
    byRepository: { friction: 1, none: 1 },
    byArea: { tooling: 1, none: 1 },
    byImpact: { retry: 1, "slow-path": 1 },
    byStatus: { open: 1, resolved: 1 },
    redactedRecordCount: 0,
    replacementCount: 0,
    exactRepeats: [],
  };
  const stats = renderStats(statsData, piped);
  assert.match(stats, /Friction statistics/u);
  assert.match(stats, /Summary/u);
  assert.match(stats, /By status/u);
  assert.match(stats, /Privacy/u);
  assert.doesNotMatch(stats, escapeSequence);

  const doctor = renderDoctor(
    [
      { name: "runtime", status: "ok", message: "Runtime is supported." },
      { name: "setup-codex", status: "warn", message: "Setup is incomplete." },
      { name: "event-health", status: "error", message: "One event is invalid." },
    ],
    piped,
  );
  assert.match(doctor, /Friction doctor/u);
  assert.match(doctor, /1 check passed · 1 warning · 1 error/u);
  assert.match(doctor, /✓ runtime\s+Runtime is supported\./u);
  assert.match(doctor, /! setup codex\s+Setup is incomplete\./u);
  assert.match(doctor, /× event health\s+One event is invalid\./u);
  assert.doesNotMatch(doctor, escapeSequence);
});
