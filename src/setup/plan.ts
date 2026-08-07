import { homedir } from "node:os";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import { requireWorktreeRoot } from "../repository/worktree.js";
import {
  captureInstruction,
  loadSetupAssets,
  packagedSkillPaths,
} from "./assets.js";
import { canonicalizeSetupRoot, inspectSetupFile } from "./files.js";
import { activeCodexInstructionPath } from "./preconditions.js";
import { planManagedBlock, planOwnedFile } from "./target-plan.js";
import type {
  MutationState,
  SetupData,
  SetupHarness,
  SetupPlan,
  SetupPrecondition,
  SetupScope,
  SetupTarget,
} from "./types.js";

function overallState(targets: readonly SetupTarget[]): MutationState {
  for (const state of ["conflict", "create", "update", "remove"] as const) {
    if (targets.some((target) => target.state === state)) {
      return state;
    }
  }

  return "noop";
}

async function addCodexTargets(
  targets: SetupTarget[],
  preconditions: SetupPrecondition[],
  instructionRoot: string,
  undo: boolean,
  instruction: Buffer,
): Promise<void> {
  const override = path.join(instructionRoot, "AGENTS.override.md");
  const agents = path.join(instructionRoot, "AGENTS.md");
  const overrideSnapshot = await inspectSetupFile(instructionRoot, override);
  const agentsSnapshot = await inspectSetupFile(instructionRoot, agents);
  const selectedPath = activeCodexInstructionPath(override, overrideSnapshot, agents);
  preconditions.push({
    kind: "codex-instruction-precedence",
    scopeRoot: instructionRoot,
    overridePath: override,
    overrideSnapshot,
    agentsPath: agents,
    agentsSnapshot,
    selectedPath,
  });

  for (const instructionPath of undo ? [override, agents] : [selectedPath]) {
    targets.push(
      await planManagedBlock(
        instructionRoot,
        instructionPath,
        instruction,
        undo,
        instructionPath === override ? overrideSnapshot : agentsSnapshot,
      ),
    );
  }
}

async function addSkillTargets(
  targets: SetupTarget[],
  scopeRoot: string,
  skillsRoot: string,
  undo: boolean,
  skills: Awaited<ReturnType<typeof loadSetupAssets>>["skills"],
): Promise<void> {
  for (const asset of skills) {
    targets.push(
      await planOwnedFile(
        asset.assetId,
        scopeRoot,
        path.join(skillsRoot, asset.relativePath),
        asset.bytes,
        undo,
      ),
    );
  }
}

export async function buildSetupPlan(input: {
  harness: SetupHarness;
  scope: SetupScope;
  undo: boolean;
  cwd: string;
}): Promise<SetupPlan> {
  if (input.harness === "generic") {
    if (input.undo) {
      throw new FrictionFailure("invalid_input");
    }

    return {
      harness: "generic",
      scope: input.scope,
      lockRoots: [],
      undo: false,
      targets: [],
      preconditions: [],
      snippet: `printf '%s\\n' "<what you were doing -> obstacle/effect -> likely prevention>" | friction add --stdin --source generic\nSkills: ${packagedSkillPaths().join(", ")}`,
    };
  }

  const userHome = await canonicalizeSetupRoot(homedir());
  const scopeRoot = input.scope === "user" ? userHome : await requireWorktreeRoot(input.cwd);
  const assets = await loadSetupAssets();
  const targets: SetupTarget[] = [];
  const preconditions: SetupPrecondition[] = [];

  if (input.harness === "codex") {
    const requestedInstructionRoot =
      input.scope === "user"
        ? path.resolve(process.env["CODEX_HOME"] || path.join(userHome, ".codex"))
        : scopeRoot;
    const instructionRoot = input.scope === "user"
      ? await canonicalizeSetupRoot(requestedInstructionRoot)
      : requestedInstructionRoot;
    await addCodexTargets(
      targets,
      preconditions,
      instructionRoot,
      input.undo,
      captureInstruction(assets.captureTemplate, "codex"),
    );
    const skillsRoot =
      input.scope === "user"
        ? path.join(userHome, ".agents", "skills")
        : path.join(scopeRoot, ".agents", "skills");
    await addSkillTargets(targets, scopeRoot, skillsRoot, input.undo, assets.skills);
  } else {
    const claudeRoot =
      input.scope === "user" ? path.join(userHome, ".claude") : path.join(scopeRoot, ".claude");
    targets.push(
      await planOwnedFile(
        "claude-rule",
        scopeRoot,
        path.join(claudeRoot, "rules", "friction.md"),
        captureInstruction(assets.captureTemplate, "claude-code"),
        input.undo,
      ),
    );
    await addSkillTargets(
      targets,
      scopeRoot,
      path.join(claudeRoot, "skills"),
      input.undo,
      assets.skills,
    );
  }

  return {
    harness: input.harness,
    scope: input.scope,
    lockRoots: [...new Set(targets.map((target) => target.scopeRoot))].sort(),
    undo: input.undo,
    targets,
    preconditions,
    snippet: null,
  };
}

export function setupData(plan: SetupPlan, applied: boolean): SetupData {
  return {
    harness: plan.harness,
    scope: plan.scope,
    action: plan.undo
      ? applied
        ? "undo"
        : "preview-undo"
      : applied
        ? "apply"
        : "preview-apply",
    state: overallState(plan.targets),
    mutations: plan.targets.map((target) => ({
      path: target.path,
      kind: target.kind,
      state: target.state,
    })),
    snippet: plan.snippet,
  };
}
