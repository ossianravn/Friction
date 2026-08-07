import {
  isArea,
  isImpact,
  isSource,
  type FrictionEvent,
  type ObservationEvent,
  type ReopenedEvent,
  type RepositoryContext,
  type ResolvedEvent,
} from "./events.js";
import {
  BODY_MAX_BYTES,
  BRANCH_MAX_BYTES,
  CWD_RELATIVE_MAX_BYTES,
  fitsUtf8,
  LIFECYCLE_NOTE_MAX_BYTES,
  LIFECYCLE_VERIFICATION_MAX_BYTES,
  MODEL_MAX_BYTES,
  REPOSITORY_NAME_MAX_BYTES,
} from "./limits.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}

export function isRfc3339UtcMilliseconds(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return false;
  }

  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function isText(value: unknown, maximumBytes: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !value.includes("\0") &&
    fitsUtf8(value, maximumBytes)
  );
}

function isRepositoryContext(value: unknown): value is RepositoryContext {
  if (!isRecord(value) || !hasExactKeys(value, ["key", "name", "branch", "head", "cwdRelative"])) {
    return false;
  }

  return (
    typeof value["key"] === "string" &&
    /^[0-9a-f]{64}$/.test(value["key"]) &&
    isText(value["name"], REPOSITORY_NAME_MAX_BYTES) &&
    (value["branch"] === null || isText(value["branch"], BRANCH_MAX_BYTES)) &&
    (value["head"] === null ||
      (typeof value["head"] === "string" &&
        /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value["head"]))) &&
    isText(value["cwdRelative"], CWD_RELATIVE_MAX_BYTES)
  );
}

function isEventBase(value: Record<string, unknown>): boolean {
  const redaction = value["redaction"];

  return (
    value["schemaVersion"] === 1 &&
    typeof value["eventId"] === "string" &&
    /^evt_[0-9a-f]{32}$/.test(value["eventId"]) &&
    typeof value["observationId"] === "string" &&
    /^fr_[0-9a-f]{32}$/.test(value["observationId"]) &&
    isRfc3339UtcMilliseconds(value["createdAt"]) &&
    isRecord(redaction) &&
    hasExactKeys(redaction, ["rulesetVersion", "replacementCount"]) &&
    redaction["rulesetVersion"] === 1 &&
    Number.isSafeInteger(redaction["replacementCount"]) &&
    Number(redaction["replacementCount"]) >= 0 &&
    typeof value["clientVersion"] === "string" &&
    value["clientVersion"].length > 0
  );
}

export function isObservationEvent(value: unknown): value is ObservationEvent {
  if (!isRecord(value) || !isEventBase(value)) {
    return false;
  }

  const eventImpacts = value["impacts"];
  const source = value["source"];
  const area = value["area"];

  return (
    value["eventType"] === "observation" &&
    isText(value["body"], BODY_MAX_BYTES) &&
    typeof source === "string" &&
    isSource(source) &&
    (value["model"] === null || isText(value["model"], MODEL_MAX_BYTES)) &&
    (area === null || (typeof area === "string" && isArea(area))) &&
    Array.isArray(eventImpacts) &&
    eventImpacts.every(
      (impact): impact is ObservationEvent["impacts"][number] =>
        typeof impact === "string" && isImpact(impact),
    ) &&
    new Set(eventImpacts).size === eventImpacts.length &&
    (value["repository"] === null || isRepositoryContext(value["repository"]))
  );
}

function isLifecycleBase(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    isEventBase(value) &&
    typeof value["actor"] === "string" &&
    isSource(value["actor"]) &&
    (value["note"] === null || isText(value["note"], LIFECYCLE_NOTE_MAX_BYTES))
  );
}

export function isResolvedEvent(value: unknown): value is ResolvedEvent {
  return (
    isLifecycleBase(value) &&
    value["eventType"] === "resolved" &&
    (value["verification"] === null ||
      isText(value["verification"], LIFECYCLE_VERIFICATION_MAX_BYTES))
  );
}

export function isReopenedEvent(value: unknown): value is ReopenedEvent {
  return isLifecycleBase(value) && value["eventType"] === "reopened";
}

export function isFrictionEvent(value: unknown): value is FrictionEvent {
  return isObservationEvent(value) || isResolvedEvent(value) || isReopenedEvent(value);
}
