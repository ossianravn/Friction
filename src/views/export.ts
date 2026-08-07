import type { PublicObservationRecord } from "./public-record.js";
import type { ScopeDisplay } from "./query.js";
import { compareText } from "../domain/sort.js";

export type ExportFormat = "markdown" | "jsonl";

function fenceFor(value: string): string {
  const runs = value.match(/`+/g) ?? [];
  const maximum = runs.reduce((length, run) => Math.max(length, run.length), 0);
  return "`".repeat(Math.max(3, maximum + 1));
}

function fenced(value: string): string {
  const fence = fenceFor(value);
  return `${fence}\n${value}\n${fence}`;
}

function inlineCode(value: string): string {
  const normalized = value.replaceAll(/\s+/g, " ").trim();
  const runs = normalized.match(/`+/g) ?? [];
  const maximum = runs.reduce((length, run) => Math.max(length, run.length), 0);
  const fence = "`".repeat(maximum + 1);
  return `${fence}${normalized}${fence}`;
}

function renderRecord(record: PublicObservationRecord): string {
  const repository =
    record.repository === null
      ? "none"
      : `${record.repository.name}:${record.repository.cwdRelative}`;
  const lines = [
    `## ${record.observationId}`,
    "",
    `- Created: ${record.createdAt}`,
    `- Status: ${record.status}`,
    `- Source: ${record.source}`,
    `- Area: ${record.area ?? "none"}`,
    `- Impacts: ${record.impacts.length === 0 ? "none" : record.impacts.join(", ")}`,
    `- Repository: ${inlineCode(repository)}`,
    "",
    fenced(record.body),
  ];

  if (record.resolution !== null) {
    lines.push("", `Resolved: ${record.resolution.createdAt}`);

    if (record.resolution.note !== null) {
      lines.push("", "Resolution note:", fenced(record.resolution.note));
    }

    if (record.resolution.verification !== null) {
      lines.push("", "Verification:", fenced(record.resolution.verification));
    }
  }

  return lines.join("\n");
}

export function renderExport(
  format: ExportFormat,
  scope: ScopeDisplay,
  records: readonly PublicObservationRecord[],
): string {
  const sorted = [...records].sort(
    (left, right) =>
      compareText(left.createdAt, right.createdAt) ||
      compareText(left.observationId, right.observationId),
  );

  if (format === "jsonl") {
    return sorted.length === 0
      ? ""
      : `${sorted.map((record) => JSON.stringify(record)).join("\n")}\n`;
  }

  const scopeText = scope.repo === "all" ? "all repositories" : scope.name;
  const header = `# Friction export\n\nScope: ${inlineCode(scopeText)}\n\nRecords: ${sorted.length}`;
  return sorted.length === 0
    ? `${header}\n`
    : `${header}\n\n${sorted.map(renderRecord).join("\n\n")}\n`;
}
