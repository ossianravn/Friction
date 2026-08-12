import type { RawReadFilters } from "../domain/filters.js";

export type ImplementedCommand =
  | "add"
  | "list"
  | "stats"
  | "resolve"
  | "reopen"
  | "export"
  | "publish"
  | "purge"
  | "doctor"
  | "setup"
  | "schema";

export type ParsedRequest =
  | { kind: "help"; command: ImplementedCommand | null }
  | { kind: "version" }
  | {
      kind: "add";
      json: boolean;
      positionalBody: string | null;
      stdin: boolean;
      source: string | undefined;
      model: string | undefined;
      area: string | undefined;
      impacts: string[];
    }
  | ({ kind: "list"; json: boolean; limit: string | undefined } & RawReadFilters)
  | ({ kind: "stats"; json: boolean } & RawReadFilters)
  | {
      kind: "resolve" | "reopen";
      json: boolean;
      observationId: string;
      note: string | undefined;
      verification: string | undefined;
      source: string | undefined;
    }
  | ({ kind: "export"; json: boolean; format: string | undefined; output: string | undefined; force: boolean } & RawReadFilters)
  | {
      kind: "publish";
      json: boolean;
      ids: string[];
      allOpen: boolean;
      output: string | undefined;
      apply: boolean;
    }
  | { kind: "purge"; json: boolean; observationId: string; apply: boolean }
  | { kind: "doctor"; json: boolean; integration: string | undefined }
  | { kind: "setup-list"; json: boolean }
  | {
      kind: "setup";
      json: boolean;
      integration: string;
      scope: string | undefined;
      workspace: string | undefined;
      source: string | undefined;
      shell: string | undefined;
      apply: boolean;
      undo: boolean;
    }
  | { kind: "schema" };
