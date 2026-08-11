import { runDoctor } from "../../doctor/checks.js";
import { renderDoctor } from "../../views/doctor.js";
import type { HumanRenderOptions } from "../../views/presentation.js";
import { exitCodes } from "../exit-codes.js";
import type { CommandExecution } from "./types.js";

export async function executeDoctor(
  presentation: HumanRenderOptions,
): Promise<CommandExecution> {
  const checks = await runDoctor();
  const hasError = checks.some((check) => check.status === "error");

  return {
    command: "doctor",
    data: { checks },
    human: renderDoctor(checks, presentation),
    warnings: [],
    exitCode: hasError ? exitCodes.internalOrIo : exitCodes.success,
  };
}
