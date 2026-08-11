import type { ObservationRecord } from "../domain/events.js";
import {
  contentWidth,
  formatTimestamp,
  renderDivider,
  styleText,
  type HumanRenderOptions,
  type TextTone,
} from "./presentation.js";
import type { ScopeDisplay } from "./query.js";
import { toPublicRecord, type PublicObservationRecord } from "./public-record.js";
import { wrapText } from "./text-layout.js";

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

function summaryLabel(data: ListData): string {
  return `${countLabel(data)} · ${scopeLabel(data.scope)}`;
}

function statusTone(status: PublicObservationRecord["status"]): TextTone {
  return status === "open" ? "warning" : "success";
}

function renderMetadata(
  record: PublicObservationRecord,
  options: HumanRenderOptions,
): string | null {
  const fields: string[] = [];

  if (record.repository !== null) {
    fields.push(`repo ${record.repository.name}:${record.repository.cwdRelative}`);
    if (record.repository.branch !== null) {
      fields.push(`branch ${record.repository.branch}`);
    }
  }

  if (record.area !== null) {
    fields.push(`area ${record.area}`);
  }

  if (record.impacts.length > 0) {
    fields.push(`impact ${record.impacts.join(", ")}`);
  }

  if (fields.length === 0) {
    return null;
  }

  const prefix = "  ";
  const width = Math.max(1, contentWidth(options) - prefix.length);
  return wrapText(fields.join(" · "), width)
    .map((line) => styleText(options, "muted", `${prefix}${line}`))
    .join("\n");
}

function renderBody(
  record: PublicObservationRecord,
  options: HumanRenderOptions,
): string {
  const prefix = styleText(options, "muted", "  │ ");
  const width = Math.max(1, contentWidth(options) - 4);
  return wrapText(record.body, width)
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function renderRecord(
  record: PublicObservationRecord,
  options: HumanRenderOptions,
): string {
  const status = record.status.toUpperCase();
  const symbol = record.status === "open" ? "●" : "✓";
  const metadata = renderMetadata(record, options);
  const identity = [
    styleText(options, statusTone(record.status), `${symbol} ${status}`),
    styleText(options, "muted", ` · ${formatTimestamp(record.createdAt)} · `),
    styleText(options, "accent", record.observationId),
  ].join("");

  return [
    identity,
    ...(metadata === null ? [] : [metadata]),
    "",
    renderBody(record, options),
  ].join("\n");
}

export function renderList(
  data: ListData,
  options: HumanRenderOptions,
): string {
  const header = [
    styleText(options, "heading", "Friction observations"),
    styleText(options, "muted", summaryLabel(data)),
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
    "",
    styleText(options, "muted", `End · ${summaryLabel(data)}`),
  ].join("\n") + "\n";
}
