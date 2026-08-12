import path from "node:path";

import {
  addManagedBlocks,
  addSkills,
  createPlan,
  instruction,
  requireScopeRoot,
  type AdapterContext,
} from "./planning.js";
import type { SetupPlan } from "../setup/types.js";

export async function planStandard(context: AdapterContext): Promise<SetupPlan> {
  const root = requireScopeRoot(context);
  const targets: SetupPlan["targets"] = [];
  await addManagedBlocks(
    targets,
    root,
    [path.join(root, "AGENTS.md")],
    instruction(context, "generic", "portable"),
    context.undo,
  );
  await addSkills(
    targets,
    root,
    path.join(root, ".agents", "skills"),
    context.undo,
    context.assets,
  );
  return createPlan(context, { targets });
}

export async function planSkills(context: AdapterContext): Promise<SetupPlan> {
  const root = requireScopeRoot(context);
  const targets: SetupPlan["targets"] = [];
  await addSkills(
    targets,
    root,
    path.join(root, ".agents", "skills"),
    context.undo,
    context.assets,
    context.scope === "user" ? "private" : "shared",
  );
  return createPlan(context, { targets });
}
