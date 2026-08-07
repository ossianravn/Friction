import type { ObservationRecord } from "../domain/events.js";
import type { ScopeDisplay } from "./query.js";
import { toPublicRecord, type PublicObservationRecord } from "./public-record.js";

export type ListData = {
  scope: ScopeDisplay;
  records: PublicObservationRecord[];
  count: number;
  total: number;
  truncated: boolean;
};

export function listData(
  scope: ScopeDisplay,
  records: readonly ObservationRecord[],
  total: number,
): ListData {
  return {
    scope,
    records: records.map(toPublicRecord),
    count: records.length,
    total,
    truncated: records.length < total,
  };
}

export function renderList(data: ListData): string {
  if (data.records.length === 0) {
    return "No observations found.\n";
  }

  return `${data.records
    .map((record) => {
      const area = record.area ?? "unclassified";
      const impacts = record.impacts.length === 0 ? "none" : record.impacts.join(", ");
      const repository =
        record.repository === null
          ? "none"
          : `${record.repository.name}:${record.repository.cwdRelative}`;

      return [
        `${record.observationId}  ${record.createdAt}  ${record.status}`,
        `area: ${area}  impacts: ${impacts}  repository: ${repository}`,
        record.body,
      ].join("\n");
    })
    .join("\n\n")}\n`;
}
