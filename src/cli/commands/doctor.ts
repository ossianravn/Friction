import { runDoctor } from "../../doctor/checks.js";
import { renderDoctor } from "../../views/doctor.js";
import type { HumanRenderOptions } from "../../views/presentation.js";
import { exitCodes } from "../exit-codes.js";
import type { CommandExecution } from "./types.js";
import type { ParsedRequest } from "../requests.js";

export async function executeDoctor(
  presentation: HumanRenderOptions,
  request: Extract<ParsedRequest, { kind: "doctor" }>,
): Promise<CommandExecution> {
  const checks = await runDoctor(process.cwd(), request.integration);
  const hasError = checks.some((check) => check.status === "error");

  return {
    command: "doctor",
    data: { checks },
    human: renderDoctor(checks, presentation),
    warnings: [],
    exitCode: hasError ? exitCodes.internalOrIo : exitCodes.success,
  };
}
