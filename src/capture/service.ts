import type { ObservationEvent } from "../domain/events.js";
import { FrictionFailure } from "../domain/failures.js";
import { systemClock, type Clock } from "../platform/clock.js";
import { createEventId, createObservationId } from "../platform/ids.js";
import { discoverRepository } from "../repository/discover.js";
import { redact } from "../security/redact.js";
import { resolveFrictionPaths } from "../storage/paths.js";
import { writeEvent } from "../storage/event-store.js";
import { CLI_VERSION } from "../version.js";
import { validateCaptureInput, type RawCaptureInput } from "./input.js";

export type CaptureReceipt = {
  observationId: string;
  createdAt: string;
  source: ObservationEvent["source"];
  repository: { name: string } | null;
  redactionCount: number;
  repositoryWarning: boolean;
};

export type CaptureDependencies = {
  clock?: Clock;
  cwd?: string;
};

function screen(value: string): ReturnType<typeof redact> {
  try {
    return redact(value);
  } catch {
    throw new FrictionFailure("safety_failure");
  }
}

export async function captureObservation(
  rawInput: RawCaptureInput,
  dependencies: CaptureDependencies = {},
): Promise<CaptureReceipt> {
  const input = validateCaptureInput(rawInput);
  const body = screen(input.body);
  const model = input.model === null ? null : screen(input.model);
  const cwd = dependencies.cwd ?? process.cwd();
  let repository;

  try {
    repository = await discoverRepository(cwd);
  } catch (error) {
    if (error instanceof FrictionFailure) {
      throw error;
    }

    repository = { state: "repository-unavailable" as const, replacementCount: 0 };
  }

  const replacementCount =
    body.replacementCount +
    (model?.replacementCount ?? 0) +
    repository.replacementCount;
  const event: ObservationEvent = {
    schemaVersion: 1,
    eventType: "observation",
    eventId: createEventId(),
    observationId: createObservationId(),
    createdAt: (dependencies.clock ?? systemClock).now().toISOString(),
    body: body.text,
    source: input.source,
    model: model?.text ?? null,
    area: input.area,
    impacts: input.impacts,
    repository: repository.state === "repository" ? repository.context : null,
    redaction: {
      rulesetVersion: 1,
      replacementCount,
    },
    clientVersion: CLI_VERSION,
  };

  try {
    const storedEvent = await writeEvent(resolveFrictionPaths(), event);

    if (storedEvent.eventType !== "observation") {
      throw new FrictionFailure("internal_error");
    }

    return {
      observationId: storedEvent.observationId,
      createdAt: storedEvent.createdAt,
      source: storedEvent.source,
      repository: storedEvent.repository === null
        ? null
        : { name: storedEvent.repository.name },
      redactionCount: replacementCount,
      repositoryWarning: repository.state === "repository-unavailable",
    };
  } catch (error) {
    if (error instanceof FrictionFailure) {
      throw error;
    }

    throw new FrictionFailure("io_error");
  }
}
