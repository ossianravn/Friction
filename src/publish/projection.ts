import type { ObservationRecord } from "../domain/events.js";
import { isArea, isImpact, isSource } from "../domain/events.js";
import { redact } from "../security/redact.js";
import type { PublishedObservation } from "./types.js";

const observationKeys = [
  "schemaVersion",
  "observationId",
  "createdAt",
  "status",
  "body",
  "source",
  "model",
  "area",
  "impacts",
  "repository",
  "resolution",
  "redactionCount",
] as const;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}

function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  );
}

function safeString(value: unknown): value is string {
  return typeof value === "string" && redact(value).replacementCount === 0;
}

function boundedSafeString(value: unknown, maximumBytes: number): value is string {
  return safeString(value) && Buffer.byteLength(value, "utf8") <= maximumBytes;
}

export function isPublishedObservation(value: unknown): value is PublishedObservation {
  const item = record(value);

  if (item === null || !exactKeys(item, observationKeys)) {
    return false;
  }

  const repository = record(item["repository"]);
  const resolution = item["resolution"] === null ? null : record(item["resolution"]);
  const impacts = item["impacts"];
  const source = item["source"];
  const area = item["area"];

  return (
    item["schemaVersion"] === 1 &&
    typeof item["observationId"] === "string" &&
    /^fr_[0-9a-f]{32}$/.test(item["observationId"]) &&
    timestamp(item["createdAt"]) &&
    (item["status"] === "open" || item["status"] === "resolved") &&
    boundedSafeString(item["body"], 4_096) &&
    typeof source === "string" &&
    isSource(source) &&
    (item["model"] === null || boundedSafeString(item["model"], 128)) &&
    (area === null || (typeof area === "string" && isArea(area))) &&
    Array.isArray(impacts) &&
    impacts.every((impact) => typeof impact === "string" && isImpact(impact)) &&
    new Set(impacts).size === impacts.length &&
    repository !== null &&
    exactKeys(repository, ["name", "branch", "cwdRelative"]) &&
    boundedSafeString(repository["name"], 255) &&
    (repository["branch"] === null || boundedSafeString(repository["branch"], 512)) &&
    boundedSafeString(repository["cwdRelative"], 2_048) &&
    (resolution === null ||
      (exactKeys(resolution, ["createdAt", "note", "verification"]) &&
        timestamp(resolution["createdAt"]) &&
        (resolution["note"] === null || boundedSafeString(resolution["note"], 2_048)) &&
        (resolution["verification"] === null ||
          boundedSafeString(resolution["verification"], 512)))) &&
    ((item["status"] === "open" && resolution === null) ||
      (item["status"] === "resolved" && resolution !== null)) &&
    Number.isSafeInteger(item["redactionCount"]) &&
    Number(item["redactionCount"]) >= 0
  );
}

function screened(value: string): { text: string; replacements: number } {
  const result = redact(value);
  return { text: result.text, replacements: result.replacementCount };
}

export function toPublishedObservation(record: ObservationRecord): PublishedObservation {
  const observation = record.observation;
  const repository = observation.repository!;
  const values = [
    screened(observation.body),
    ...(observation.model === null ? [] : [screened(observation.model)]),
    screened(repository.name),
    ...(repository.branch === null ? [] : [screened(repository.branch)]),
    screened(repository.cwdRelative),
    ...(record.resolution?.note === null || record.resolution?.note === undefined
      ? []
      : [screened(record.resolution.note)]),
    ...(record.resolution?.verification === null || record.resolution?.verification === undefined
      ? []
      : [screened(record.resolution.verification)]),
  ];
  const [body, ...rest] = values;
  let offset = 0;
  const next = (): string => rest[offset++]!.text;
  const model = observation.model === null ? null : next();
  const name = next();
  const branch = repository.branch === null ? null : next();
  const cwdRelative = next();
  const note = record.resolution?.note === null || record.resolution?.note === undefined ? null : next();
  const verification =
    record.resolution?.verification === null || record.resolution?.verification === undefined
      ? null
      : next();

  return {
    schemaVersion: 1,
    observationId: observation.observationId,
    createdAt: observation.createdAt,
    status: record.status,
    body: body!.text,
    source: observation.source,
    model,
    area: observation.area,
    impacts: [...observation.impacts],
    repository: { name, branch, cwdRelative },
    resolution:
      record.resolution === null
        ? null
        : { createdAt: record.resolution.createdAt, note, verification },
    redactionCount:
      observation.redaction.replacementCount +
      (record.resolution?.redaction.replacementCount ?? 0) +
      values.reduce((count, value) => count + value.replacements, 0),
  };
}
