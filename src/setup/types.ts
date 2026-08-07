export type SetupHarness = "codex" | "claude-code" | "generic";
export type SetupScope = "user" | "repo";
export type SetupTargetKind = "managed-block" | "owned-file";
export type MutationState = "create" | "update" | "remove" | "noop" | "conflict";

export type FileSnapshot = {
  exists: boolean;
  bytes: Buffer;
  mode: number | null;
  digest: string | null;
};

export type SetupTarget = {
  path: string;
  kind: SetupTargetKind;
  snapshot: FileSnapshot;
  desiredBytes: Buffer | null;
  state: MutationState;
};

export type SetupPlan = {
  harness: SetupHarness;
  scope: SetupScope;
  scopeRoot: string;
  undo: boolean;
  targets: SetupTarget[];
  snippet: string | null;
};

export type SetupData = {
  harness: SetupHarness;
  scope: SetupScope;
  action: "preview-apply" | "apply" | "preview-undo" | "undo";
  state: MutationState;
  mutations: Array<{ path: string; kind: SetupTargetKind; state: MutationState }>;
  snippet: string | null;
};
