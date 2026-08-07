import {
  isSource,
  type FrictionEvent,
  type Source,
} from "../domain/events.js";
import { FrictionFailure } from "../domain/failures.js";
import {
  LIFECYCLE_NOTE_MAX_BYTES,
  LIFECYCLE_VERIFICATION_MAX_BYTES,
} from "../domain/limits.js";
import { systemClock, type Clock } from "../platform/clock.js";
import { createEventId } from "../platform/ids.js";
import { redact } from "../security/redact.js";
import { writeEvent } from "../storage/event-store.js";
import { loadEvents } from "../storage/load-events.js";
import { resolveFrictionPaths } from "../storage/paths.js";
import { CLI_VERSION } from "../version.js";
import { foldEvents } from "./fold.js";

export type LifecycleInput = {
  action: "resolve" | "reopen";
  observationId: string;
  note: string | undefined;
  verification: string | undefined;
  source: string | undefined;
};

export type LifecycleReceipt = {
  observationId: string;
  changed: boolean;
  status: "open" | "resolved";
  lifecycleEventId: string | null;
  eventFindingCount: number;
  corpusFindingCount: number;
};

function validateOptionalText(
  value: string | undefined,
  maximumBytes: number,
): string | null {
  if (value === undefined) {
    return null;
  }

  if (Buffer.byteLength(value, "utf8") > maximumBytes || value.includes("\0")) {
    throw new FrictionFailure("invalid_input");
  }

  const normalized = value.replaceAll("\r\n", "\n").trim();

  if (normalized.length === 0) {
    throw new FrictionFailure("invalid_input");
  }

  return normalized;
}

function screen(value: string | null): ReturnType<typeof redact> | null {
  if (value === null) {
    return null;
  }

  try {
    return redact(value);
  } catch {
    throw new FrictionFailure("safety_failure");
  }
}

export async function changeLifecycle(
  input: LifecycleInput,
  clock: Clock = systemClock,
): Promise<LifecycleReceipt> {
  if (!/^fr_[0-9a-f]{32}$/.test(input.observationId)) {
    throw new FrictionFailure("invalid_input");
  }

  const source = input.source ?? "manual";

  if (!isSource(source)) {
    throw new FrictionFailure("invalid_input");
  }

  if (input.action === "reopen" && input.verification !== undefined) {
    throw new FrictionFailure("invalid_input");
  }

  const note = screen(validateOptionalText(input.note, LIFECYCLE_NOTE_MAX_BYTES));
  const verification = screen(
    validateOptionalText(input.verification, LIFECYCLE_VERIFICATION_MAX_BYTES),
  );
  const paths = resolveFrictionPaths();
  const loaded = await loadEvents(paths);
  const folded = foldEvents(loaded.events.map((entry) => entry.event));
  const record = folded.records.find(
    (candidate) => candidate.observation.observationId === input.observationId,
  );

  if (record === undefined) {
    throw new FrictionFailure("not_found");
  }

  const targetStatus = input.action === "resolve" ? "resolved" : "open";

  if (record.status === targetStatus) {
    return {
      observationId: input.observationId,
      changed: false,
      status: targetStatus,
      lifecycleEventId: null,
      eventFindingCount: loaded.findings.length,
      corpusFindingCount: folded.findings.length,
    };
  }

  const base = {
    schemaVersion: 1 as const,
    eventId: createEventId(),
    observationId: input.observationId,
    createdAt: clock.now().toISOString(),
    actor: source as Source,
    note: note?.text ?? null,
    redaction: {
      rulesetVersion: 1 as const,
      replacementCount:
        (note?.replacementCount ?? 0) +
        (verification?.replacementCount ?? 0),
    },
    clientVersion: CLI_VERSION,
  };
  const event: FrictionEvent =
    input.action === "resolve"
      ? {
          ...base,
          eventType: "resolved",
          verification: verification?.text ?? null,
        }
      : { ...base, eventType: "reopened" };
  const stored = await writeEvent(paths, event);

  return {
    observationId: input.observationId,
    changed: true,
    status: targetStatus,
    lifecycleEventId: stored.eventId,
    eventFindingCount: loaded.findings.length,
    corpusFindingCount: folded.findings.length,
  };
}
