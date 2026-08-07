import { runDoctor } from "../../doctor/checks.js";
import { exitCodes } from "../exit-codes.js";
import type { CommandExecution } from "./types.js";

export async function executeDoctor(): Promise<CommandExecution> {
  const checks = await runDoctor();
  const hasError = checks.some((check) => check.status === "error");
  const human = `${checks
    .map((check) => `${check.status.toUpperCase()} ${check.name}: ${check.message}`)
    .join("\n")}\n`;

  return {
    command: "doctor",
    data: { checks },
    human,
    warnings: [],
    exitCode: hasError ? exitCodes.internalOrIo : exitCodes.success,
  };
}
