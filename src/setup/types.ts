import type {
  IntegrationId,
  ScopeCapability,
  SetupScope,
} from "../integrations/types.js";

export type SetupTargetKind = "managed-block" | "owned-file";
export type MutationState = "create" | "update" | "remove" | "noop" | "conflict";

export type FileSnapshot = {
  exists: boolean;
  bytes: Buffer;
  mode: number | null;
  digest: string | null;
};

export type SetupTarget = {
  scopeRoot: string;
  path: string;
  kind: SetupTargetKind;
  permissions: "private" | "shared";
  snapshot: FileSnapshot;
  desiredBytes: Buffer | null;
  state: MutationState;
};

export type FileSnapshotsPrecondition = {
  kind: "file-snapshots";
  scopeRoot: string;
  files: Array<{ path: string; snapshot: FileSnapshot }>;
};

export type SetupPlan = {
  integration: IntegrationId;
  scope: SetupScope;
  lockRoots: string[];
  undo: boolean;
  targets: SetupTarget[];
  preconditions: FileSnapshotsPrecondition[];
  coverage: ScopeCapability;
  manualSteps: string[];
  snippet: string | null;
  warnings: SetupWarning[];
};

export type SetupWarning = {
  code: "shared_skills_retained";
  message: string;
};

export type SetupData = {
  integration: IntegrationId;
  scope: SetupScope;
  action: "preview-apply" | "apply" | "preview-undo" | "undo";
  state: MutationState;
  ready: boolean;
  coverage: ScopeCapability;
  mutations: Array<{ path: string; kind: SetupTargetKind; state: MutationState }>;
  manualSteps: string[];
  snippet: string | null;
};
