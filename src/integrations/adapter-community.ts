import path from "node:path";

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

async function addSharedSkills(
  context: AdapterContext,
  targets: SetupPlan["targets"],
  root: string,
): Promise<void> {
  if (!context.undo) {
    await addSkills(
      targets,
      root,
      path.join(root, ".agents", "skills"),
      false,
      context.assets,
      context.scope === "user" ? "private" : "shared",
    );
  }
}

function sharedUndoWarnings(context: AdapterContext) {
  return context.undo ? [retainedSkillsWarning()] : [];
}

export async function planOpenCode(
  context: AdapterContext,
): Promise<SetupPlan> {
  const root = requireScopeRoot(context);
  const agentsPath = context.scope === "user"
    ? path.join(root, ".config", "opencode", "AGENTS.md")
    : path.join(root, "AGENTS.md");
  const fallbackPath = context.scope === "user"
    ? path.join(root, ".claude", "CLAUDE.md")
    : path.join(root, "CLAUDE.md");
  const files = await snapshots(root, [agentsPath, fallbackPath]);
  const agents = files[0]!;
  const fallback = files[1]!;
  const fallbackActive =
    !agents.snapshot.exists &&
    fallback.snapshot.exists &&
    fallback.snapshot.bytes.toString("utf8").trim().length > 0;
  const targets: SetupPlan["targets"] = [];

  if (context.undo || !fallbackActive) {
    const source = context.scope === "user" ? "opencode" : "generic";
    await addManagedBlocks(
      targets,
      root,
      [agentsPath],
      instruction(context, source, "portable"),
      context.undo,
      files,
      context.scope === "user" ? "private" : "shared",
    );
  }

  await addSharedSkills(context, targets, root);
  const manualSteps = fallbackActive && !context.undo
    ? [
        `Add the shown capture guidance to ${fallbackPath}; ` +
          "Friction will not create AGENTS.md because that would shadow " +
          "the active fallback.",
      ]
    : [];
  const source = context.scope === "user" ? "opencode" : "generic";
  return createPlan(context, {
    targets,
    preconditions: [{ kind: "file-snapshots", scopeRoot: root, files }],
    coverage: fallbackActive && !context.undo
      ? { ...context.coverage, capture: "manual" }
      : context.coverage,
    manualSteps,
    snippet: manualSteps.length > 0
      ? instruction(context, source, "portable").toString("utf8")
      : null,
    warnings: sharedUndoWarnings(context),
  });
}

export async function planPi(context: AdapterContext): Promise<SetupPlan> {
  const root = requireScopeRoot(context);
  const instructionRoot =
    context.scope === "user" ? path.join(root, ".pi", "agent") : root;
  const agentsPath = path.join(instructionRoot, "AGENTS.md");
  const files = await snapshots(root, [agentsPath]);
  const targets: SetupPlan["targets"] = [];
  const source = context.scope === "user" ? "pi" : "generic";
  await addManagedBlocks(
    targets,
    root,
    [agentsPath],
    instruction(context, source, "portable"),
    context.undo,
    files,
    context.scope === "user" ? "private" : "shared",
  );
  await addSharedSkills(context, targets, root);
  return createPlan(context, {
    targets,
    preconditions: [{
      kind: "file-snapshots",
      scopeRoot: root,
      files,
    }],
    warnings: sharedUndoWarnings(context),
  });
}

export async function planWarp(context: AdapterContext): Promise<SetupPlan> {
  const root = requireScopeRoot(context);
  const targets: SetupPlan["targets"] = [];
  const warnings = sharedUndoWarnings(context);

  if (context.scope === "repo") {
    await addManagedBlocks(
      targets,
      root,
      [path.join(root, "AGENTS.md")],
      instruction(context, "generic", "portable"),
      context.undo,
    );
  }

  await addSharedSkills(context, targets, root);

  if (context.scope === "repo") {
    return createPlan(context, { targets, warnings });
  }

  return createPlan(context, {
    targets,
    warnings,
    manualSteps: context.undo
      ? [
          "In Warp, open Settings > AI > Knowledge > Manage Rules and " +
            "remove the Friction Global Rule manually.",
        ]
      : [
          "In Warp, open Settings > AI > Knowledge > Manage Rules " +
            "(or run /add-rule), then add the shown capture guidance " +
            "as a Global Rule.",
        ],
    snippet: context.undo
      ? null
      : instruction(context, "warp", "portable").toString("utf8"),
  });
}
