import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import { requireWorktreeRoot } from "../repository/worktree.js";
import {
  captureInstruction,
  loadSetupAssets,
  packagedSkillPaths,
} from "./assets.js";
import { inspectSetupFile } from "./files.js";
import { planManagedBlock, planOwnedFile } from "./target-plan.js";
import type {
  MutationState,
  SetupData,
  SetupHarness,
  SetupPlan,
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

async function codexTargets(
  scopeRoot: string,
  instructionRoot: string,
  undo: boolean,
): Promise<string[]> {
  const override = path.join(instructionRoot, "AGENTS.override.md");
  const agents = path.join(instructionRoot, "AGENTS.md");

  if (undo) {
    return [override, agents];
  }

  const overrideSnapshot = await inspectSetupFile(scopeRoot, override);
  return [
    overrideSnapshot.exists && overrideSnapshot.bytes.toString("utf8").trim().length > 0
      ? override
      : agents,
  ];
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
      scopeRoot: input.cwd,
      undo: false,
      targets: [],
      snippet: `printf '%s\\n' "<what you were doing -> obstacle/effect -> likely prevention>" | friction add --stdin --source generic\nSkills: ${packagedSkillPaths().join(", ")}`,
    };
  }

  const userHome = await realpath(homedir());
  const scopeRoot = input.scope === "user" ? userHome : await requireWorktreeRoot(input.cwd);
  const assets = await loadSetupAssets();
  const targets: SetupTarget[] = [];

  if (input.harness === "codex") {
    const instructionRoot =
      input.scope === "user"
        ? path.resolve(process.env["CODEX_HOME"] || path.join(userHome, ".codex"))
        : scopeRoot;
    const instructionPaths = await codexTargets(scopeRoot, instructionRoot, input.undo);

    for (const instructionPath of instructionPaths) {
      targets.push(
        await planManagedBlock(
          scopeRoot,
          instructionPath,
          captureInstruction(assets.captureTemplate, "codex"),
          input.undo,
        ),
      );
    }
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
    scopeRoot,
    undo: input.undo,
    targets,
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
