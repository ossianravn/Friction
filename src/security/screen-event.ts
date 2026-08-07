import type {
  FrictionEvent,
  ObservationEvent,
  ReopenedEvent,
  RepositoryContext,
  ResolvedEvent,
} from "../domain/events.js";
import { redact, type RedactionResult } from "./redact.js";

function optional(value: string | null): RedactionResult | null {
  return value === null ? null : redact(value);
}

function screenRepository(repository: RepositoryContext | null): {
  value: RepositoryContext | null;
  replacementCount: number;
} {
  if (repository === null) {
    return { value: null, replacementCount: 0 };
  }

  const name = redact(repository.name);
  const branch = optional(repository.branch);
  const cwdRelative = redact(repository.cwdRelative);
  return {
    value: {
      ...repository,
      name: name.text,
      branch: branch?.text ?? null,
      cwdRelative: cwdRelative.text,
    },
    replacementCount:
      name.replacementCount +
      (branch?.replacementCount ?? 0) +
      cwdRelative.replacementCount,
  };
}

function screenObservation(event: ObservationEvent): ObservationEvent {
  const body = redact(event.body);
  const model = optional(event.model);
  const repository = screenRepository(event.repository);
  const replacements =
    body.replacementCount +
    (model?.replacementCount ?? 0) +
    repository.replacementCount;

  return {
    ...event,
    body: body.text,
    model: model?.text ?? null,
    repository: repository.value,
    redaction: {
      rulesetVersion: 1,
      replacementCount: event.redaction.replacementCount + replacements,
    },
  };
}

function screenResolved(event: ResolvedEvent): ResolvedEvent {
  const note = optional(event.note);
  const verification = optional(event.verification);
  return {
    ...event,
    note: note?.text ?? null,
    verification: verification?.text ?? null,
    redaction: {
      rulesetVersion: 1,
      replacementCount:
        event.redaction.replacementCount +
        (note?.replacementCount ?? 0) +
        (verification?.replacementCount ?? 0),
    },
  };
}

function screenReopened(event: ReopenedEvent): ReopenedEvent {
  const note = optional(event.note);
  return {
    ...event,
    note: note?.text ?? null,
    redaction: {
      rulesetVersion: 1,
      replacementCount: event.redaction.replacementCount + (note?.replacementCount ?? 0),
    },
  };
}

export function screenLoadedEvent(event: FrictionEvent): FrictionEvent {
  if (event.eventType === "observation") {
    return screenObservation(event);
  }

  return event.eventType === "resolved"
    ? screenResolved(event)
    : screenReopened(event);
}
