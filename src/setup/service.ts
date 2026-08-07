import { FrictionFailure } from "../domain/failures.js";
import { executableOnPath } from "../platform/path.js";
import { applySetupPlan } from "./apply.js";
import { buildSetupPlan, setupData } from "./plan.js";
import type { SetupData, SetupHarness, SetupScope } from "./types.js";

export type SetupInput = {
  harness: string;
  scope: string | undefined;
  apply: boolean;
  undo: boolean;
};

export type SetupResult = {
  data: SetupData;
  pathWarning: boolean;
};

export async function runSetup(input: SetupInput): Promise<SetupResult> {
  if (
    input.harness !== "codex" &&
    input.harness !== "claude-code" &&
    input.harness !== "generic"
  ) {
    throw new FrictionFailure("invalid_input");
  }

  const scope = input.scope ?? "user";

  if (scope !== "user" && scope !== "repo") {
    throw new FrictionFailure("invalid_input");
  }

  if (input.harness === "generic" && (input.apply || input.undo)) {
    throw new FrictionFailure("invalid_input");
  }

  const plan = await buildSetupPlan({
    harness: input.harness as SetupHarness,
    scope: scope as SetupScope,
    undo: input.undo,
    cwd: process.cwd(),
  });

  if (input.apply) {
    await applySetupPlan(plan);
  }

  return {
    data: setupData(plan, input.apply),
    pathWarning: !(await executableOnPath("friction")),
  };
}
