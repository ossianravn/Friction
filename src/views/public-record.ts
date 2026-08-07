import type { ObservationRecord } from "../domain/events.js";

export type PublicObservationRecord = {
  observationId: string;
  createdAt: string;
  body: string;
  source: ObservationRecord["observation"]["source"];
  model: string | null;
  area: ObservationRecord["observation"]["area"];
  impacts: ObservationRecord["observation"]["impacts"];
  repository: {
    name: string;
    branch: string | null;
    cwdRelative: string;
  } | null;
  status: ObservationRecord["status"];
  resolution: {
    createdAt: string;
    note: string | null;
    verification: string | null;
  } | null;
  redactionCount: number;
};

export function materializedRedactionCount(record: ObservationRecord): number {
  return (
    record.observation.redaction.replacementCount +
    (record.resolution?.redaction.replacementCount ?? 0)
  );
}

export function toPublicRecord(record: ObservationRecord): PublicObservationRecord {
  const observation = record.observation;

  return {
    observationId: observation.observationId,
    createdAt: observation.createdAt,
    body: observation.body,
    source: observation.source,
    model: observation.model,
    area: observation.area,
    impacts: [...observation.impacts],
    repository:
      observation.repository === null
        ? null
        : {
            name: observation.repository.name,
            branch: observation.repository.branch,
            cwdRelative: observation.repository.cwdRelative,
          },
    status: record.status,
    resolution:
      record.resolution === null
        ? null
        : {
            createdAt: record.resolution.createdAt,
            note: record.resolution.note,
            verification: record.resolution.verification,
          },
    redactionCount: materializedRedactionCount(record),
  };
}
