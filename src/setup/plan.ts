import { homedir } from "node:os";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import type { Source } from "../domain/source.js";
import { planOpenCode, planPi, planWarp } from "../integrations/adapter-community.js";
import { planClaudeCode, planCodex } from "../integrations/adapter-native.js";
import { planSkills, planStandard } from "../integrations/adapter-standard.js";
import { planHermes, planOpenClaw } from "../integrations/adapter-workspace.js";
import { integrationById } from "../integrations/catalog.js";
import { createPlan, type AdapterContext } from "../integrations/planning.js";
import type {
  CaptureTransport,
  IntegrationId,
  ScopeCapability,
  SetupScope,
} from "../integrations/types.js";
import { getEnvironmentValue } from "../platform/environment.js";
import { resolveRuntimePlatform } from "../platform/runtime-platform.js";
import { assertSafeWindowsPathInput } from "../platform/windows/path-policy.js";
import { requireWorktreeRoot } from "../repository/worktree.js";
import {
  genericCaptureSnippet,
  loadSetupAssets,
} from "./assets.js";
import { canonicalizeSetupRoot } from "./files.js";
import type {
  MutationState,
  SetupData,
  SetupPlan,
  SetupTarget,
} from "./types.js";

export type BuildSetupInput = {
  integration: IntegrationId;
  scope: SetupScope;
  undo: boolean;
  cwd: string;
  workspace: string | undefined;
  source: Source | undefined;
  transport: CaptureTransport | undefined;
};

function overallState(targets: readonly SetupTarget[]): MutationState {
  for (const state of ["conflict", "create", "update", "remove"] as const) {
    if (targets.some((target) => target.state === state)) {
      return state;
    }
  }

  return "noop";
}

function capability(
  integration: IntegrationId,
  scope: SetupScope,
): ScopeCapability {
  const match = integrationById(integration).capabilities.find(
    (candidate) => candidate.scope === scope,
  );

  if (match === undefined) {
    throw new FrictionFailure("invalid_input");
  }

  return { ...match };
}

async function requestedRoot(
  value: string,
  cwd: string,
): Promise<string> {
  const windows = resolveRuntimePlatform() === "win32";
  const checked = windows ? assertSafeWindowsPathInput(value) : value;
  return canonicalizeSetupRoot(path.resolve(cwd, checked));
}

async function scopeRoot(
  input: BuildSetupInput,
  userHome: string,
): Promise<string | null> {
  if (input.scope === "user") {
    return userHome;
  }

  if (input.scope === "repo") {
    return requireWorktreeRoot(input.cwd);
  }

  if (input.workspace === undefined) {
    throw new FrictionFailure("invalid_input");
  }

  return requestedRoot(input.workspace, input.cwd);
}

function defaultTransport(
  integration: IntegrationId,
): CaptureTransport {
  if (integration === "codex") {
    return resolveRuntimePlatform() === "win32" ? "powershell" : "posix";
  }

  return integration === "claude-code" ? "posix" : "portable";
}

export async function buildSetupPlan(input: BuildSetupInput): Promise<SetupPlan> {
  const assets = await loadSetupAssets();

  if (input.integration === "generic") {
    const source = input.source ?? "generic";
    const transport = input.transport ?? "portable";
    const context: AdapterContext = {
      integration: "generic",
      scope: input.scope,
      undo: false,
      userHome: homedir(),
      scopeRoot: null,
      assets,
      coverage: capability("generic", input.scope),
      source,
      transport,
    };
    return createPlan(context, {
      snippet: genericCaptureSnippet(assets, source, transport),
      manualSteps: [
        "Place the shown capture guidance and packaged skills in the target agent environment.",
      ],
    });
  }

  const userHome = await canonicalizeSetupRoot(homedir());
  const root = await scopeRoot(input, userHome);
  const context: AdapterContext = {
    integration: input.integration,
    scope: input.scope,
    undo: input.undo,
    userHome,
    scopeRoot: root,
    assets,
    coverage: capability(input.integration, input.scope),
    source: input.source ?? null,
    transport: input.transport ?? defaultTransport(input.integration),
  };

  switch (input.integration) {
    case "standard":
      return planStandard(context);
    case "skills":
      return planSkills(context);
    case "codex": {
      const configured = input.scope === "user"
        ? getEnvironmentValue("CODEX_HOME") ?? path.join(userHome, ".codex")
        : root;
      const instructionRoot = configured === null
        ? null
        : await requestedRoot(configured, input.cwd);

      if (instructionRoot === null) {
        throw new FrictionFailure("invalid_input");
      }

      return planCodex(context, instructionRoot);
    }
    case "claude-code":
      return planClaudeCode(context);
    case "opencode":
      return planOpenCode(context);
    case "pi":
      return planPi(context);
    case "warp":
      return planWarp(context);
    case "openclaw":
      return planOpenClaw(context);
    case "hermes": {
      const configured = getEnvironmentValue("HERMES_HOME") ??
        path.join(userHome, ".hermes");
      return planHermes(
        context,
        await requestedRoot(configured, input.cwd),
      );
    }
  }
}

function isReady(plan: SetupPlan, applied: boolean, state: MutationState): boolean {
  if (
    plan.undo ||
    plan.manualSteps.length > 0 ||
    plan.coverage.capture !== "managed" ||
    plan.coverage.skills !== "managed"
  ) {
    return false;
  }

  return applied || state === "noop";
}

export function setupData(plan: SetupPlan, applied: boolean): SetupData {
  const state = overallState(plan.targets);
  return {
    integration: plan.integration,
    scope: plan.scope,
    action: plan.undo
      ? applied
        ? "undo"
        : "preview-undo"
      : applied
        ? "apply"
        : "preview-apply",
    state,
    ready: isReady(plan, applied, state),
    coverage: plan.coverage,
    mutations: plan.targets.map((target) => ({
      path: target.path,
      kind: target.kind,
      state: target.state,
    })),
    manualSteps: plan.manualSteps,
    snippet: plan.snippet,
  };
}
