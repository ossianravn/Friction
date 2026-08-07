import type { Area, Impact, Source } from "../domain/events.js";

export type PublishedObservation = {
  schemaVersion: 1;
  observationId: string;
  createdAt: string;
  status: "open" | "resolved";
  body: string;
  source: Source;
  model: string | null;
  area: Area | null;
  impacts: Impact[];
  repository: {
    name: string;
    branch: string | null;
    cwdRelative: string;
  };
  resolution: null | {
    createdAt: string;
    note: string | null;
    verification: string | null;
  };
  redactionCount: number;
};

export type PublishSnapshot = {
  exists: boolean;
  digest: string | null;
  mode: number | null;
  bytes: Buffer;
  records: PublishedObservation[];
};

export type PublishPlan = {
  root: string;
  targetPath: string;
  snapshot: PublishSnapshot;
  desiredBytes: Buffer;
  selected: PublishedObservation[];
  creates: number;
  updates: number;
  unchanged: number;
};
