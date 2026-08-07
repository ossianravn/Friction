import type {
  FrictionEvent,
  ObservationRecord,
} from "../domain/events.js";
import { compareText } from "../domain/sort.js";

export type CorpusFinding = {
  type: "duplicate-observation" | "orphan-lifecycle";
  observationId: string;
};

export type FoldResult = {
  records: ObservationRecord[];
  findings: CorpusFinding[];
};

export function foldEvents(events: readonly FrictionEvent[]): FoldResult {
  const sorted = [...events].sort(
    (left, right) =>
      compareText(left.createdAt, right.createdAt) ||
      compareText(left.eventId, right.eventId),
  );
  const records = new Map<string, ObservationRecord>();
  const findings: CorpusFinding[] = [];

  for (const event of sorted) {
    if (event.eventType !== "observation") {
      continue;
    }

    if (records.has(event.observationId)) {
      findings.push({
        type: "duplicate-observation",
        observationId: event.observationId,
      });
      continue;
    }

    records.set(event.observationId, {
      observation: event,
      status: "open",
      resolution: null,
      lastLifecycleEvent: null,
    });
  }

  for (const event of sorted) {
    if (event.eventType === "observation") {
      continue;
    }

    const record = records.get(event.observationId);

    if (record === undefined) {
      findings.push({
        type: "orphan-lifecycle",
        observationId: event.observationId,
      });
      continue;
    }

    if (event.eventType === "resolved") {
      record.status = "resolved";
      record.resolution = event;
    } else {
      record.status = "open";
      record.resolution = null;
    }

    record.lastLifecycleEvent = event;
  }

  return { records: [...records.values()], findings };
}
