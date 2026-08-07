import { constants } from "node:fs";
import { open, readdir } from "node:fs/promises";
import path from "node:path";

import {
  isFrictionEvent,
  type FrictionEvent,
} from "../domain/events.js";
import { FrictionFailure } from "../domain/failures.js";
import { compareText } from "../domain/sort.js";
import { screenLoadedEvent } from "../security/screen-event.js";
import {
  rejectSymlinkedHome,
  rejectUnsafeStoreDirectory,
  type FrictionPaths,
} from "./paths.js";

const MAXIMUM_EVENT_BYTES = 32 * 1_024;

export type EventFindingType =
  | "symlink"
  | "non-regular"
  | "unreadable"
  | "oversized"
  | "malformed"
  | "unknown-version"
  | "unknown-event-type"
  | "invalid-event"
  | "filename-mismatch"
  | "unknown-properties";

export type EventFinding = {
  fileName: string;
  type: EventFindingType;
  observationId: string | null;
};

export type LoadedEvent = {
  event: FrictionEvent;
  fileName: string;
  bytes: Buffer;
};

export type LoadEventsResult = {
  events: LoadedEvent[];
  findings: EventFinding[];
};

function isMissing(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

async function readBoundedFile(filePath: string): Promise<Buffer | null> {
  const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);

  try {
    const status = await handle.stat();

    if (!status.isFile() || status.size > MAXIMUM_EVENT_BYTES) {
      return null;
    }

    const bytes = Buffer.alloc(MAXIMUM_EVENT_BYTES + 1);
    let offset = 0;

    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, null);

      if (result.bytesRead === 0) {
        break;
      }

      offset += result.bytesRead;
    }

    return offset > MAXIMUM_EVENT_BYTES ? null : bytes.subarray(0, offset);
  } finally {
    await handle.close();
  }
}

function expectedKeys(event: FrictionEvent): readonly string[] {
  const base = [
    "schemaVersion",
    "eventType",
    "eventId",
    "observationId",
    "createdAt",
    "redaction",
    "clientVersion",
  ];

  if (event.eventType === "observation") {
    return [...base, "body", "source", "model", "area", "impacts", "repository"];
  }

  if (event.eventType === "resolved") {
    return [...base, "actor", "note", "verification"];
  }

  return [...base, "actor", "note"];
}

function finding(
  fileName: string,
  type: EventFindingType,
  value?: Record<string, unknown>,
): EventFinding {
  const observationId = value?.["observationId"];
  return {
    fileName,
    type,
    observationId:
      typeof observationId === "string" && /^fr_[0-9a-f]{32}$/.test(observationId)
        ? observationId
        : null,
  };
}

function parseEvent(
  bytes: Buffer,
  fileName: string,
): { loaded: LoadedEvent | null; finding: EventFinding | null } {
  let value: unknown;

  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    return { loaded: null, finding: finding(fileName, "malformed") };
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { loaded: null, finding: finding(fileName, "invalid-event") };
  }

  const record = value as Record<string, unknown>;

  if (record["schemaVersion"] !== 1) {
    return { loaded: null, finding: finding(fileName, "unknown-version", record) };
  }

  if (!(["observation", "resolved", "reopened"] as unknown[]).includes(record["eventType"])) {
    return { loaded: null, finding: finding(fileName, "unknown-event-type", record) };
  }

  if (!isFrictionEvent(value)) {
    return { loaded: null, finding: finding(fileName, "invalid-event", record) };
  }

  if (fileName !== `${value.eventId}.json`) {
    return { loaded: null, finding: finding(fileName, "filename-mismatch", record) };
  }

  const allowedKeys = new Set(expectedKeys(value));
  const hasUnknownProperties = Object.keys(record).some((key) => !allowedKeys.has(key));

  return {
    loaded: { event: screenLoadedEvent(value), fileName, bytes },
    finding: hasUnknownProperties
      ? finding(fileName, "unknown-properties", record)
      : null,
  };
}

export async function loadEvents(paths: FrictionPaths): Promise<LoadEventsResult> {
  await rejectSymlinkedHome(paths.home);
  await rejectUnsafeStoreDirectory(paths.events);
  let entries;

  try {
    entries = await readdir(paths.events, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) {
      return { events: [], findings: [] };
    }

    throw new FrictionFailure("io_error");
  }

  const events: LoadedEvent[] = [];
  const findings: EventFinding[] = [];

  for (const entry of entries.sort((left, right) => compareText(left.name, right.name))) {
    if (!entry.name.endsWith(".json")) {
      continue;
    }

    if (entry.isSymbolicLink()) {
      findings.push(finding(entry.name, "symlink"));
      continue;
    }

    if (!entry.isFile()) {
      findings.push(finding(entry.name, "non-regular"));
      continue;
    }

    try {
      const bytes = await readBoundedFile(path.join(paths.events, entry.name));

      if (bytes === null) {
        findings.push(finding(entry.name, "oversized"));
        continue;
      }

      const parsed = parseEvent(bytes, entry.name);

      if (parsed.loaded !== null) {
        events.push(parsed.loaded);
      }

      if (parsed.finding !== null) {
        findings.push(parsed.finding);
      }
    } catch {
      findings.push(finding(entry.name, "unreadable"));
    }
  }

  events.sort((left, right) =>
    compareText(left.event.createdAt, right.event.createdAt) ||
    compareText(left.event.eventId, right.event.eventId),
  );
  return { events, findings };
}
