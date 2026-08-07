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
export const eventTypes = ["observation", "resolved", "reopened"] as const;

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
