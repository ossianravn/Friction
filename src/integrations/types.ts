import type { Source } from "../domain/source.js";

export const integrationIds = [
  "standard",
  "skills",
  "codex",
  "claude-code",
  "opencode",
  "pi",
  "warp",
  "openclaw",
  "hermes",
  "generic",
] as const;

export const setupScopes = ["user", "repo", "workspace"] as const;
export const captureTransports = ["posix", "powershell", "portable"] as const;

export type IntegrationId = (typeof integrationIds)[number];
export type SetupScope = (typeof setupScopes)[number];
export type CaptureTransport = (typeof captureTransports)[number];
export type CapabilityMode = "managed" | "manual" | "unsupported";
export type RuntimeMode = "local" | "workspace" | "remote-environment" | "unknown";
export type SupportState =
  | "Managed"
  | "Project standard"
  | "Workspace managed"
  | "Manual"
  | "Compatible, unverified";
export type ValidationState = "validated" | "under-validation";

export type ScopeCapability = {
  scope: SetupScope;
  capture: CapabilityMode;
  skills: CapabilityMode;
  runtime: RuntimeMode;
  support: SupportState;
  validation: ValidationState;
  source: Source | "custom" | "conditional" | null;
};

export type IntegrationCatalogEntry = {
  id: IntegrationId;
  label: string;
  defaultScope: SetupScope;
  supportedScopes: readonly SetupScope[];
  workspaceRequired: boolean;
  sourceOverride: boolean;
  transports: readonly CaptureTransport[];
  capabilities: readonly ScopeCapability[];
  caveats: readonly string[];
};

export function isIntegrationId(value: string): value is IntegrationId {
  return (integrationIds as readonly string[]).includes(value);
}

export function isSetupScope(value: string): value is SetupScope {
  return (setupScopes as readonly string[]).includes(value);
}

export function isCaptureTransport(value: string): value is CaptureTransport {
  return (captureTransports as readonly string[]).includes(value);
}
