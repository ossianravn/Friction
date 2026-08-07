import type { ScreenedText } from "../security/screened-text.js";

export const sources = ["manual", "codex", "claude-code", "generic"] as const;
export const areas = [
  "design",
  "docs",
  "tooling",
  "configuration",
  "tests",
  "dependency",
  "harness",
  "environment",
  "workflow",
  "other",
] as const;
export const impacts = [
  "retry",
  "backtrack",
  "workaround",
  "extra-search",
  "blocked",
  "false-evidence",
  "slow-path",
  "unclear-owner",
] as const;

export type Source = (typeof sources)[number];
export type Area = (typeof areas)[number];
export type Impact = (typeof impacts)[number];

export type RepositoryContext = {
  key: string;
  name: ScreenedText;
  branch: ScreenedText | null;
  head: string | null;
  cwdRelative: ScreenedText;
};

export type ObservationEvent = {
  schemaVersion: 1;
  eventType: "observation";
  eventId: string;
  observationId: string;
  createdAt: string;
  body: ScreenedText;
  source: Source;
  model: ScreenedText | null;
  area: Area | null;
  impacts: Impact[];
  repository: RepositoryContext | null;
  redaction: {
    rulesetVersion: 1;
    replacementCount: number;
  };
  clientVersion: string;
};

export type ResolvedEvent = {
  schemaVersion: 1;
  eventType: "resolved";
  eventId: string;
  observationId: string;
  createdAt: string;
  actor: Source;
  note: ScreenedText | null;
  verification: ScreenedText | null;
  redaction: RedactionMetadata;
  clientVersion: string;
};

export type ReopenedEvent = {
  schemaVersion: 1;
  eventType: "reopened";
  eventId: string;
  observationId: string;
  createdAt: string;
  actor: Source;
  note: ScreenedText | null;
  redaction: RedactionMetadata;
  clientVersion: string;
};

export type RedactionMetadata = {
  rulesetVersion: 1;
  replacementCount: number;
};

export type FrictionEvent = ObservationEvent | ResolvedEvent | ReopenedEvent;

export type ObservationRecord = {
  observation: ObservationEvent;
  status: "open" | "resolved";
  resolution: ResolvedEvent | null;
  lastLifecycleEvent: ResolvedEvent | ReopenedEvent | null;
};

export function isSource(value: string): value is Source {
  return (sources as readonly string[]).includes(value);
}

export function isArea(value: string): value is Area {
  return (areas as readonly string[]).includes(value);
}

export function isImpact(value: string): value is Impact {
  return (impacts as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRepositoryContext(value: unknown): value is RepositoryContext {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value["key"] === "string" &&
    /^[0-9a-f]{64}$/.test(value["key"]) &&
    typeof value["name"] === "string" &&
    (value["branch"] === null || typeof value["branch"] === "string") &&
    (value["head"] === null ||
      (typeof value["head"] === "string" &&
        /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value["head"]))) &&
    typeof value["cwdRelative"] === "string"
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
    typeof value["createdAt"] === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(
      value["createdAt"],
    ) &&
    isRecord(redaction) &&
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
    typeof value["body"] === "string" &&
    typeof source === "string" &&
    isSource(source) &&
    (value["model"] === null || typeof value["model"] === "string") &&
    (area === null || (typeof area === "string" && isArea(area))) &&
    Array.isArray(eventImpacts) &&
    eventImpacts.every(
      (impact): impact is Impact =>
        typeof impact === "string" && isImpact(impact),
    ) &&
    new Set(eventImpacts).size === eventImpacts.length &&
    (value["repository"] === null ||
      isRepositoryContext(value["repository"]))
  );
}

function isLifecycleBase(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    isEventBase(value) &&
    typeof value["actor"] === "string" &&
    isSource(value["actor"]) &&
    (value["note"] === null || typeof value["note"] === "string")
  );
}

export function isResolvedEvent(value: unknown): value is ResolvedEvent {
  return (
    isLifecycleBase(value) &&
    value["eventType"] === "resolved" &&
    (value["verification"] === null || typeof value["verification"] === "string")
  );
}

export function isReopenedEvent(value: unknown): value is ReopenedEvent {
  return isLifecycleBase(value) && value["eventType"] === "reopened";
}

export function isFrictionEvent(value: unknown): value is FrictionEvent {
  return (
    isObservationEvent(value) || isResolvedEvent(value) || isReopenedEvent(value)
  );
}
