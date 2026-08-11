import { renderList, listData } from "../../views/list.js";
import type { HumanRenderOptions } from "../../views/presentation.js";
import { queryList, queryRecords } from "../../views/query.js";
import { renderStats, statsData } from "../../views/stats.js";
import type { ParsedRequest } from "../requests.js";
import { warningsFromQuery } from "../warnings.js";
import type { CommandExecution } from "./types.js";

type ListRequest = Extract<ParsedRequest, { kind: "list" }>;
type StatsRequest = Extract<ParsedRequest, { kind: "stats" }>;

export async function executeList(
  request: ListRequest,
  presentation: HumanRenderOptions,
): Promise<CommandExecution> {
  const query = await queryList(request);
  const data = listData(query.scope, query.records, query.total);

  return {
    command: "list",
    data,
    human: renderList(data, presentation),
    warnings: warningsFromQuery(query.warnings),
  };
}

export async function executeStats(
  request: StatsRequest,
  presentation: HumanRenderOptions,
): Promise<CommandExecution> {
  const query = await queryRecords(request);
  const data = statsData(query.scope, query.records);

  return {
    command: "stats",
    data,
    human: renderStats(data, presentation),
    warnings: warningsFromQuery(query.warnings),
  };
}
