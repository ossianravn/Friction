import type { FailureCode } from "../domain/failures.js";
import type { ImplementedCommand } from "./requests.js";
import { errorRegistry } from "./errors.js";

export type CommandName = ImplementedCommand | "unknown";

export type CliWarning = {
  code:
    | "repository_unavailable"
    | "event_findings"
    | "corpus_findings"
    | "shared_copies"
    | "path_unavailable"
    | "shared_skills_retained";
  message: string;
};

export const repositoryUnavailableWarning: CliWarning = {
  code: "repository_unavailable",
  message: "Repository attribution was unavailable.",
};

type WritableOutput = {
  write(value: string): unknown;
};

export function writeJsonSuccess(
  output: WritableOutput,
  command: ImplementedCommand,
  data: unknown,
  warnings: readonly CliWarning[],
): void {
  output.write(
    `${JSON.stringify({ version: 1, ok: true, command, data, warnings })}\n`,
  );
}

export function writeJsonError(
  output: WritableOutput,
  command: CommandName,
  code: FailureCode,
): void {
  const definition = errorRegistry[code];
  output.write(
    `${JSON.stringify({
      version: 1,
      ok: false,
      command,
      error: {
        code,
        message: definition.message,
        retryable: definition.retryable,
      },
      warnings: [],
    })}\n`,
  );
}

export function writeHumanError(output: WritableOutput, code: FailureCode): void {
  output.write(`Error: ${errorRegistry[code].message}\n`);
}
