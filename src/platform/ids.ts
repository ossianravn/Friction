import { randomUUID } from "node:crypto";

function compactUuid(): string {
  return randomUUID().replaceAll("-", "");
}

export function createEventId(): string {
  return `evt_${compactUuid()}`;
}

export function createObservationId(): string {
  return `fr_${compactUuid()}`;
}
