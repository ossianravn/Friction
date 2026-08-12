import path from "node:path";

import { firstNonemptyPath } from "../setup/preconditions.js";
import { planOwnedFile } from "../setup/target-plan.js";
import type { SetupPlan } from "../setup/types.js";
import {
  addManagedBlocks,
  addSkills,
  createPlan,
  instruction,
  requireScopeRoot,
  retainedSkillsWarning,
  snapshots,
  type AdapterContext,
} from "./planning.js";

export async function planCodex(
  context: AdapterContext,
  instructionRoot: string,
): Promise<SetupPlan> {
  const sharedRoot = requireScopeRoot(context);
  const targets: SetupPlan["targets"] = [];
  const preconditions: SetupPlan["preconditions"] = [];
  const overridePath = path.join(instructionRoot, "AGENTS.override.md");
  const agentsPath = path.join(instructionRoot, "AGENTS.md");
  const files = await snapshots(instructionRoot, [overridePath, agentsPath]);
  preconditions.push({ kind: "file-snapshots", scopeRoot: instructionRoot, files });
  const selectedPath = firstNonemptyPath(files, agentsPath);
  const instructionPaths = context.undo ? [overridePath, agentsPath] : [selectedPath];
  const source = context.scope === "user" ? "codex" : "generic";
  const transport = context.scope === "user" ? context.transport : "portable";
  await addManagedBlocks(
    targets,
    instructionRoot,
    instructionPaths,
    instruction(context, source, transport),
    context.undo,
    files,
    context.scope === "user" ? "private" : "shared",
  );

  if (!context.undo) {
    await addSkills(
      targets,
      sharedRoot,
      path.join(sharedRoot, ".agents", "skills"),
      false,
      context.assets,
      context.scope === "user" ? "private" : "shared",
    );
  }

  return createPlan(context, {
    targets,
    preconditions,
    warnings: context.undo ? [retainedSkillsWarning()] : [],
  });
}

export async function planClaudeCode(
  context: AdapterContext,
): Promise<SetupPlan> {
  const root = requireScopeRoot(context);
  const claudeRoot = path.join(root, ".claude");
  const targets: SetupPlan["targets"] = [
    await planOwnedFile(
      "claude-rule",
      root,
      path.join(claudeRoot, "rules", "friction.md"),
      instruction(context, "claude-code", "posix"),
      context.undo,
      context.scope === "user" ? "private" : "shared",
    ),
  ];
  await addSkills(
    targets,
    root,
    path.join(claudeRoot, "skills"),
    context.undo,
    context.assets,
    context.scope === "user" ? "private" : "shared",
  );
  return createPlan(context, { targets });
}
