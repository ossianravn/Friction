import type { ObservationRecord } from "../domain/events.js";
import {
  parseLimit,
  parseReadFilters,
  type RawReadFilters,
} from "../domain/filters.js";
import { FrictionFailure } from "../domain/failures.js";
import { compareText } from "../domain/sort.js";
import { foldEvents } from "../lifecycle/fold.js";
import { systemClock, type Clock } from "../platform/clock.js";
import { discoverRepository } from "../repository/discover.js";
import { loadEvents } from "../storage/load-events.js";
import { resolveFrictionPaths } from "../storage/paths.js";

export type ScopeDisplay =
  | { repo: "all" }
  | { repo: "current"; name: string };

export type QueryWarnings = {
  eventFindingCount: number;
  corpusFindingCount: number;
  repositoryWarning: boolean;
};

export type QueryResult = {
  scope: ScopeDisplay;
  records: ObservationRecord[];
  warnings: QueryWarnings;
};

export type QueryDependencies = {
  clock?: Clock;
  cwd?: string;
};

export async function queryRecords(
  rawFilters: RawReadFilters,
  dependencies: QueryDependencies = {},
): Promise<QueryResult> {
  const clock = dependencies.clock ?? systemClock;
  const filters = parseReadFilters(rawFilters, clock.now());
  const loaded = await loadEvents(resolveFrictionPaths());
  const folded = foldEvents(loaded.events.map((entry) => entry.event));
  const repository = await discoverRepository(dependencies.cwd ?? process.cwd());
  const selectedScope = filters.repo ??
    (repository.state === "not-repository" ? "all" : "current");
  const currentContext = repository.state === "repository" ? repository.context : null;

  if (selectedScope === "current" && currentContext === null) {
    throw new FrictionFailure("not_found");
  }

  let records = folded.records;

  if (selectedScope === "current") {
    const key = currentContext!.key;
    records = records.filter(
      (record) => record.observation.repository?.key === key,
    );
  }

  if (filters.status !== "all") {
    records = records.filter((record) => record.status === filters.status);
  }

  if (filters.sinceAt !== null) {
    records = records.filter(
      (record) => record.observation.createdAt >= filters.sinceAt!,
    );
  }

  return {
    scope:
      selectedScope === "all"
        ? { repo: "all" }
        : { repo: "current", name: currentContext!.name },
    records,
    warnings: {
      eventFindingCount: loaded.findings.length,
      corpusFindingCount: folded.findings.length,
      repositoryWarning: repository.state === "repository-unavailable",
    },
  };
}

export async function queryList(
  rawFilters: RawReadFilters & { limit: string | undefined },
  dependencies: QueryDependencies = {},
): Promise<QueryResult & { total: number; truncated: boolean }> {
  const result = await queryRecords(rawFilters, dependencies);
  const sorted = [...result.records].sort(
    (left, right) =>
      compareText(right.observation.createdAt, left.observation.createdAt) ||
      compareText(right.observation.observationId, left.observation.observationId),
  );
  const total = sorted.length;
  const records = sorted.slice(0, parseLimit(rawFilters.limit));

  return {
    ...result,
    records,
    total,
    truncated: records.length < total,
  };
}
