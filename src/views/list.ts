import type { ObservationRecord } from "../domain/events.js";
import {
  formatTimestamp,
  renderDivider,
  styleText,
  type HumanRenderOptions,
  type TextTone,
} from "./presentation.js";
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

function scopeLabel(scope: ScopeDisplay): string {
  return scope.repo === "all" ? "all repositories" : `repository ${scope.name}`;
}

function countLabel(data: ListData): string {
  if (data.truncated) {
    return `Showing ${data.count} of ${data.total} observations`;
  }

  return `${data.count} ${data.count === 1 ? "observation" : "observations"}`;
}

function detailLine(
  options: HumanRenderOptions,
  label: string,
  value: string,
): string {
  return `${styleText(options, "muted", label.padEnd(12))}${value}`;
}

function statusTone(status: PublicObservationRecord["status"]): TextTone {
  return status === "open" ? "warning" : "success";
}

function renderRecord(
  record: PublicObservationRecord,
  options: HumanRenderOptions,
): string {
  const status = record.status.toUpperCase();
  const symbol = record.status === "open" ? "●" : "✓";
  const details: string[] = [];

  if (record.repository !== null) {
    const branch = record.repository.branch === null
      ? ""
      : ` · branch ${record.repository.branch}`;
    details.push(
      detailLine(
        options,
        "Repository",
        `${record.repository.name}:${record.repository.cwdRelative}${branch}`,
      ),
    );
  }

  if (record.area !== null) {
    details.push(detailLine(options, "Area", record.area));
  }

  if (record.impacts.length > 0) {
    details.push(detailLine(options, "Impact", record.impacts.join(", ")));
  }

  return [
    `${styleText(options, statusTone(record.status), `${symbol} ${status}`)} · ${formatTimestamp(record.createdAt)}`,
    styleText(options, "accent", record.observationId),
    ...details,
    "",
    record.body,
  ].join("\n");
}

export function renderList(
  data: ListData,
  options: HumanRenderOptions,
): string {
  const header = [
    styleText(options, "heading", "Friction observations"),
    styleText(options, "muted", `${countLabel(data)} · ${scopeLabel(data.scope)}`),
  ];

  if (data.records.length === 0) {
    return [...header, "", "No observations found."].join("\n") + "\n";
  }

  return [
    ...header,
    "",
    data.records
      .map((record) => renderRecord(record, options))
      .join(`\n${renderDivider(options)}\n`),
  ].join("\n") + "\n";
}
