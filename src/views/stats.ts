import type { ObservationRecord } from "../domain/events.js";
import { compareText } from "../domain/sort.js";
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

function renderCounts(label: string, counts: Record<string, number>): string {
  const values = Object.entries(counts).map(([key, count]) => `${key}=${count}`);
  return `${label}: ${values.length === 0 ? "none" : values.join(", ")}`;
}

export function renderStats(data: StatsData): string {
  const lines = [
    `Observations: ${data.total}`,
    `First: ${data.firstAt ?? "none"}`,
    `Last: ${data.lastAt ?? "none"}`,
    renderCounts("By day", data.byDay),
    renderCounts("By source", data.bySource),
    renderCounts("By repository", data.byRepository),
    renderCounts("By area", data.byArea),
    renderCounts("By impact", data.byImpact),
    renderCounts("By status", data.byStatus),
    `Redacted records: ${data.redactedRecordCount}`,
    `Redaction replacements: ${data.replacementCount}`,
  ];

  if (data.exactRepeats.length > 0) {
    lines.push(
      "Exact repeats:",
      ...data.exactRepeats.map((repeat) => `${repeat.count}x ${repeat.body}`),
    );
  }

  return `${lines.join("\n")}\n`;
}
