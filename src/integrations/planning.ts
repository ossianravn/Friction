import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import type { Source } from "../domain/source.js";
import {
  captureInstruction,
  type SetupAssets,
} from "../setup/assets.js";
import { inspectSetupFile } from "../setup/files.js";
import { planManagedBlock, planOwnedFile } from "../setup/target-plan.js";
import type {
  FileSnapshot,
  SetupPlan,
  SetupTarget,
  SetupWarning,
} from "../setup/types.js";
import type {
  CaptureTransport,
  IntegrationId,
  ScopeCapability,
  SetupScope,
} from "./types.js";

export type AdapterContext = {
  integration: IntegrationId;
  scope: SetupScope;
  undo: boolean;
  userHome: string;
  scopeRoot: string | null;
  assets: SetupAssets;
  coverage: ScopeCapability;
  source: Source | null;
  transport: CaptureTransport;
};

export function createPlan(
  context: AdapterContext,
  input: {
    targets?: SetupTarget[];
    preconditions?: SetupPlan["preconditions"];
    coverage?: ScopeCapability;
    manualSteps?: string[];
    snippet?: string | null;
    warnings?: SetupWarning[];
  } = {},
): SetupPlan {
  const targets = input.targets ?? [];
  return {
    integration: context.integration,
    scope: context.scope,
    lockRoots: [...new Set(targets.map((target) => target.scopeRoot))].sort(),
    undo: context.undo,
    targets,
    preconditions: input.preconditions ?? [],
    coverage: input.coverage ?? context.coverage,
    manualSteps: input.manualSteps ?? [],
    snippet: input.snippet ?? null,
    warnings: input.warnings ?? [],
  };
}

export function requireScopeRoot(context: AdapterContext): string {
  if (context.scopeRoot === null) {
    throw new FrictionFailure("invalid_input");
  }

  return context.scopeRoot;
}

export async function snapshots(
  scopeRoot: string,
  paths: readonly string[],
): Promise<Array<{ path: string; snapshot: FileSnapshot }>> {
  return Promise.all(
    paths.map(async (targetPath) => ({
      path: targetPath,
      snapshot: await inspectSetupFile(scopeRoot, targetPath),
    })),
  );
}

export async function addManagedBlocks(
  targets: SetupTarget[],
  scopeRoot: string,
  paths: readonly string[],
  content: Buffer,
  undo: boolean,
  known?: readonly { path: string; snapshot: FileSnapshot }[],
  permissions: SetupTarget["permissions"] = "shared",
): Promise<void> {
  for (const targetPath of paths) {
    const snapshot = known?.find((file) => file.path === targetPath)?.snapshot;
    targets.push(
      await planManagedBlock(
        scopeRoot,
        targetPath,
        content,
        undo,
        snapshot,
        permissions,
      ),
    );
  }
}

export async function addSkills(
  targets: SetupTarget[],
  scopeRoot: string,
  skillsRoot: string,
  undo: boolean,
  assets: SetupAssets,
  permissions: SetupTarget["permissions"] = "shared",
): Promise<void> {
  for (const asset of assets.skills) {
    targets.push(
      await planOwnedFile(
        asset.assetId,
        scopeRoot,
        path.join(skillsRoot, asset.relativePath),
        asset.bytes,
        undo,
        permissions,
      ),
    );
  }
}

export function instruction(
  context: AdapterContext,
  source: Source,
  transport: CaptureTransport = context.transport,
): Buffer {
  return captureInstruction(context.assets, source, transport);
}

export function retainedSkillsWarning(): SetupWarning {
  return {
    code: "shared_skills_retained",
    message:
      "Shared .agents/skills were retained; use friction setup skills --undo to remove them.",
  };
}
