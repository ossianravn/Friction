import type {
  CapabilityMode,
  IntegrationCatalogEntry,
  RuntimeMode,
  ScopeCapability,
  SetupScope,
  SupportState,
  ValidationState,
} from "./types.js";
import type { Source } from "../domain/source.js";

function capability(
  scope: SetupScope,
  capture: CapabilityMode,
  skills: CapabilityMode,
  runtime: RuntimeMode,
  support: SupportState,
  validation: ValidationState,
  source: Source | "custom" | "conditional" | null,
): ScopeCapability {
  return { scope, capture, skills, runtime, support, validation, source };
}

export const integrationCatalog = [
  {
    id: "standard",
    label: "Open-standard project setup",
    defaultScope: "repo",
    supportedScopes: ["repo"],
    workspaceRequired: false,
    sourceOverride: false,
    transports: ["portable"],
    capabilities: [
      capability(
        "repo", "managed", "managed", "local",
        "Project standard", "validated", "generic",
      ),
    ],
    caveats: ["Manages root AGENTS.md and repository .agents/skills for compatible clients."],
  },
  {
    id: "skills",
    label: "Shared Agent Skills",
    defaultScope: "user",
    supportedScopes: ["user", "repo", "workspace"],
    workspaceRequired: false,
    sourceOverride: false,
    transports: [],
    capabilities: [
      capability(
        "user", "unsupported", "managed", "local",
        "Managed", "validated", null,
      ),
      capability(
        "repo", "unsupported", "managed", "local",
        "Managed", "validated", null,
      ),
      capability(
        "workspace", "unsupported", "managed", "workspace",
        "Managed", "validated", null,
      ),
    ],
    caveats: ["Owns the explicit lifecycle for shared .agents/skills assets."],
  },
  {
    id: "codex",
    label: "Codex",
    defaultScope: "user",
    supportedScopes: ["user", "repo"],
    workspaceRequired: false,
    sourceOverride: false,
    transports: ["posix", "powershell", "portable"],
    capabilities: [
      capability(
        "user", "managed", "managed", "local",
        "Managed", "validated", "codex",
      ),
      capability(
        "repo", "managed", "managed", "local",
        "Managed", "validated", "generic",
      ),
    ],
    caveats: ["Repository guidance is shared and uses generic source attribution."],
  },
  {
    id: "claude-code",
    label: "Claude Code",
    defaultScope: "user",
    supportedScopes: ["user", "repo"],
    workspaceRequired: false,
    sourceOverride: false,
    transports: ["posix"],
    capabilities: [
      capability(
        "user", "managed", "managed", "local",
        "Managed", "validated", "claude-code",
      ),
      capability(
        "repo", "managed", "managed", "local",
        "Managed", "validated", "claude-code",
      ),
    ],
    caveats: ["Uses Claude Code native rules and skill directories."],
  },
  {
    id: "opencode",
    label: "OpenCode",
    defaultScope: "user",
    supportedScopes: ["user", "repo"],
    workspaceRequired: false,
    sourceOverride: false,
    transports: ["portable"],
    capabilities: [
      capability(
        "user", "managed", "managed", "local",
        "Compatible, unverified", "under-validation", "opencode",
      ),
      capability(
        "repo", "managed", "managed", "local",
        "Compatible, unverified", "under-validation", "generic",
      ),
    ],
    caveats: ["Capture becomes manual when creating AGENTS.md would shadow a CLAUDE.md fallback."],
  },
  {
    id: "pi",
    label: "Pi",
    defaultScope: "user",
    supportedScopes: ["user", "repo"],
    workspaceRequired: false,
    sourceOverride: false,
    transports: ["portable"],
    capabilities: [
      capability(
        "user", "managed", "managed", "local",
        "Compatible, unverified", "under-validation", "pi",
      ),
      capability(
        "repo", "managed", "managed", "local",
        "Compatible, unverified", "under-validation", "generic",
      ),
    ],
    caveats: ["Context or skill loading can be disabled; explicit skill invocation may be required."],
  },
  {
    id: "warp",
    label: "Warp",
    defaultScope: "user",
    supportedScopes: ["user", "repo"],
    workspaceRequired: false,
    sourceOverride: false,
    transports: ["portable"],
    capabilities: [
      capability(
        "user", "manual", "managed", "local",
        "Manual", "under-validation", "warp",
      ),
      capability(
        "repo", "managed", "managed", "local",
        "Project standard", "under-validation", "generic",
      ),
    ],
    caveats: ["Warp Global Rules are configured through Warp UI; remote environments require separate setup."],
  },
  {
    id: "openclaw",
    label: "OpenClaw",
    defaultScope: "workspace",
    supportedScopes: ["workspace"],
    workspaceRequired: true,
    sourceOverride: false,
    transports: ["portable"],
    capabilities: [
      capability(
        "workspace", "managed", "managed", "workspace",
        "Workspace managed", "under-validation", "openclaw",
      ),
    ],
    caveats: ["Each agent workspace and runtime must be configured independently."],
  },
  {
    id: "hermes",
    label: "Hermes Agent",
    defaultScope: "workspace",
    supportedScopes: ["workspace"],
    workspaceRequired: true,
    sourceOverride: false,
    transports: ["portable"],
    capabilities: [
      capability(
        "workspace", "managed", "managed", "workspace",
        "Workspace managed", "under-validation", "conditional",
      ),
    ],
    caveats: ["Context precedence can require manual capture guidance; remote backends require separate setup."],
  },
  {
    id: "generic",
    label: "Generic shell-capable agent",
    defaultScope: "user",
    supportedScopes: ["user"],
    workspaceRequired: false,
    sourceOverride: true,
    transports: ["posix", "powershell", "portable"],
    capabilities: [
      capability(
        "user", "manual", "manual", "unknown",
        "Manual", "validated", "custom",
      ),
    ],
    caveats: ["Output-only setup; the user places guidance and skills in the target agent environment."],
  },
] as const satisfies readonly IntegrationCatalogEntry[];

export function integrationById(id: IntegrationCatalogEntry["id"]): IntegrationCatalogEntry {
  const definition = integrationCatalog.find((candidate) => candidate.id === id);

  if (definition === undefined) {
    throw new Error(`Missing integration catalog entry: ${id}`);
  }

  return definition;
}
