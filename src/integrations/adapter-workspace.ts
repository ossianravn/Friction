import path from "node:path";

import type { Source } from "../domain/source.js";
import type { SetupPlan } from "../setup/types.js";
import {
  addManagedBlocks,
  addSkills,
  createPlan,
  instruction,
  requireScopeRoot,
  snapshots,
  type AdapterContext,
} from "./planning.js";

export async function planOpenClaw(
  context: AdapterContext,
): Promise<SetupPlan> {
  const workspace = requireScopeRoot(context);
  const targets: SetupPlan["targets"] = [];
  await addManagedBlocks(
    targets,
    workspace,
    [path.join(workspace, "AGENTS.md")],
    instruction(context, "openclaw", "portable"),
    context.undo,
  );
  await addSkills(
    targets,
    workspace,
    path.join(workspace, "skills"),
    context.undo,
    context.assets,
    "shared",
  );
  return createPlan(context, { targets });
}

function firstExisting(
  files: readonly SetupPlan["preconditions"][number]["files"][number][],
): string | null {
  return files.find((file) => file.snapshot.exists)?.path ?? null;
}

export async function planHermes(
  context: AdapterContext,
  hermesHome: string,
): Promise<SetupPlan> {
  const workspace = requireScopeRoot(context);
  const nativePaths = [
    path.join(workspace, ".hermes.md"),
    path.join(workspace, "HERMES.md"),
  ];
  const agentsPath = path.join(workspace, "AGENTS.md");
  const fallbackPaths = [
    path.join(workspace, "CLAUDE.md"),
    path.join(workspace, ".cursorrules"),
  ];
  const files = await snapshots(workspace, [
    ...nativePaths,
    agentsPath,
    ...fallbackPaths,
  ]);
  const native = firstExisting(files.slice(0, 2));
  const agents = files[2]!;
  const fallbackActive =
    native === null &&
    !agents.snapshot.exists &&
    files.slice(3).some((file) =>
      file.snapshot.exists &&
      file.snapshot.bytes.toString("utf8").trim().length > 0
    );
  const targetPath = native ?? agentsPath;
  const source: Source = native === null ? "generic" : "hermes";
  const targets: SetupPlan["targets"] = [];

  if (context.undo) {
    await addManagedBlocks(
      targets,
      workspace,
      [...nativePaths, agentsPath],
      instruction(context, "hermes", "portable"),
      true,
      files,
    );
  } else if (!fallbackActive) {
    await addManagedBlocks(
      targets,
      workspace,
      [targetPath],
      instruction(context, source, "portable"),
      false,
      files,
    );
  }

  await addSkills(
    targets,
    hermesHome,
    path.join(hermesHome, "skills"),
    context.undo,
    context.assets,
    "private",
  );
  const manualSteps = fallbackActive && !context.undo
    ? [
        "Add the shown capture guidance to the active Hermes project " +
          "context file; Friction will not create AGENTS.md because that " +
          "would change context precedence.",
      ]
    : [];
  return createPlan(context, {
    targets,
    preconditions: [{
      kind: "file-snapshots",
      scopeRoot: workspace,
      files,
    }],
    coverage: fallbackActive && !context.undo
      ? { ...context.coverage, capture: "manual" }
      : context.coverage,
    manualSteps,
    snippet: manualSteps.length > 0
      ? instruction(context, "hermes", "portable").toString("utf8")
      : null,
  });
}
