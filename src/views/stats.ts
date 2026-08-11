import type { ObservationRecord } from "../domain/events.js";
import { compareText } from "../domain/sort.js";
import {
  formatTimestamp,
  styleText,
  type HumanRenderOptions,
} from "./presentation.js";
import { materializedRedactionCount } from "./public-record.js";
import type { ScopeDisplay } from "./query.js";

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sortedObject(map: Map<string, number>): Record<string, number> {
  return Object.fromEntries([...map.entries()].sort(([left], [right]) => compareText(left, right)));
}

export type StatsData = {
  scope: ScopeDisplay;
  total: number;
  firstAt: string | null;
  lastAt: string | null;
  byDay: Record<string, number>;
  bySource: Record<string, number>;
  byRepository: Record<string, number>;
  byArea: Record<string, number>;
  byImpact: Record<string, number>;
  byStatus: Record<string, number>;
  redactedRecordCount: number;
  replacementCount: number;
  exactRepeats: Array<{ body: string; count: number }>;
};

export function statsData(scope: ScopeDisplay, records: readonly ObservationRecord[]): StatsData {
  const byDay = new Map<string, number>();
  const bySource = new Map<string, number>();
  const byRepository = new Map<string, number>();
  const byArea = new Map<string, number>();
  const byImpact = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const bodies = new Map<string, number>();
  let redactedRecordCount = 0;
  let replacementCount = 0;

  for (const record of records) {
    const observation = record.observation;
    increment(byDay, observation.createdAt.slice(0, 10));
    increment(bySource, observation.source);
    increment(byRepository, observation.repository?.name ?? "none");
    increment(byArea, observation.area ?? "none");
    increment(byStatus, record.status);
    increment(bodies, observation.body);

    for (const impact of observation.impacts) {
      increment(byImpact, impact);
    }

    const recordReplacementCount = materializedRedactionCount(record);

    if (recordReplacementCount > 0) {
      redactedRecordCount += 1;
    }

    replacementCount += recordReplacementCount;
  }

  const timestamps = records.map((record) => record.observation.createdAt).sort();
  const exactRepeats = [...bodies.entries()]
    .filter(([, count]) => count > 1)
    .map(([body, count]) => ({ body, count }))
    .sort((left, right) => right.count - left.count || compareText(left.body, right.body));

  return {
    scope,
    total: records.length,
    firstAt: timestamps[0] ?? null,
    lastAt: timestamps.at(-1) ?? null,
    byDay: sortedObject(byDay),
    bySource: sortedObject(bySource),
    byRepository: sortedObject(byRepository),
    byArea: sortedObject(byArea),
    byImpact: sortedObject(byImpact),
    byStatus: sortedObject(byStatus),
    redactedRecordCount,
    replacementCount,
    exactRepeats,
  };
}

function scopeLabel(scope: ScopeDisplay): string {
  return scope.repo === "all" ? "All repositories" : `Repository ${scope.name}`;
}

function renderRows(
  rows: ReadonlyArray<readonly [string, string]>,
  options: HumanRenderOptions,
): string[] {
  const width = Math.max(0, ...rows.map(([label]) => label.length));

  return rows.map(([label, value]) =>
    `${styleText(options, "muted", label.padEnd(width))}  ${value}`
  );
}

function renderCountSection(
  title: string,
  counts: Record<string, number>,
  options: HumanRenderOptions,
): string[] {
  const rows = Object.entries(counts);

  return [
    styleText(options, "section", title),
    ...(rows.length === 0
      ? [styleText(options, "muted", "None")]
      : renderRows(
          rows.map(([key, count]) => [key, String(count)] as const),
          options,
        )),
  ];
}

function displayTimestamp(value: string | null): string {
  return value === null ? "None" : formatTimestamp(value);
}

export function renderStats(
  data: StatsData,
  options: HumanRenderOptions,
): string {
  const sections = [
    [
      styleText(options, "section", "Summary"),
      ...renderRows(
        [
          ["Observations", String(data.total)],
          ["First recorded", displayTimestamp(data.firstAt)],
          ["Last recorded", displayTimestamp(data.lastAt)],
        ],
        options,
      ),
    ],
    renderCountSection("By status", data.byStatus, options),
    renderCountSection("By repository", data.byRepository, options),
    renderCountSection("By area", data.byArea, options),
    renderCountSection("By impact", data.byImpact, options),
    renderCountSection("By source", data.bySource, options),
    renderCountSection("By day", data.byDay, options),
    [
      styleText(options, "section", "Privacy"),
      ...renderRows(
        [
          ["Redacted records", String(data.redactedRecordCount)],
          ["Replacements", String(data.replacementCount)],
        ],
        options,
      ),
    ],
  ];

  if (data.exactRepeats.length > 0) {
    sections.push([
      styleText(options, "section", "Exact repeats"),
      ...data.exactRepeats.map((repeat) => `${repeat.count}×  ${repeat.body}`),
    ]);
  }

  return [
    styleText(options, "heading", "Friction statistics"),
    styleText(options, "muted", scopeLabel(data.scope)),
    "",
    ...sections.flatMap((section, index) => index === 0 ? section : ["", ...section]),
  ].join("\n") + "\n";
}
