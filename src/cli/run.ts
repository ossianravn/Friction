import type { Readable } from "node:stream";

import { FrictionFailure, type FailureCode } from "../domain/failures.js";
import { CLI_VERSION } from "../version.js";
import { executeAdd } from "./commands/add.js";
import { executeDoctor } from "./commands/doctor.js";
import { executeExport } from "./commands/export.js";
import { executeLifecycle } from "./commands/lifecycle.js";
import { executePurge } from "./commands/purge.js";
import { executePublish } from "./commands/publish.js";
import { executeList, executeStats } from "./commands/read.js";
import { executeSetup } from "./commands/setup.js";
import type { CommandExecution } from "./commands/types.js";
import { errorRegistry } from "./errors.js";
import {
  writeHumanError,
  writeJsonError,
  writeJsonSuccess,
  type CommandName,
} from "./output.js";
import { parseRequest } from "./parse.js";
import type { ImplementedCommand, ParsedRequest } from "./requests.js";
import { currentSchema } from "./schema.js";

type WritableOutput = {
  write(value: string): unknown;
};

export type CliIo = {
  stdin: Readable;
  stdout: WritableOutput;
  stderr: WritableOutput;
};

function commandName(arguments_: readonly string[]): CommandName {
  const command = arguments_[0];
  const implemented: readonly ImplementedCommand[] = [
    "add",
    "list",
    "stats",
    "resolve",
    "reopen",
    "export",
    "publish",
    "purge",
    "doctor",
    "setup",
    "schema",
  ];
  return command !== undefined && implemented.includes(command as ImplementedCommand)
    ? (command as ImplementedCommand)
    : "unknown";
}

function wantsJson(arguments_: readonly string[]): boolean {
  return arguments_.includes("--json");
}

function writeHelp(output: WritableOutput, command: ImplementedCommand | null): void {
  if (command !== null) {
    output.write(`Usage: friction ${command} [options]\n`);
    return;
  }

  output.write("Usage: friction <command>\n\nCommands:\n  add\n  list\n  stats\n  resolve\n  reopen\n  export\n  publish\n  purge\n  doctor\n  setup\n  schema\n");
}

function failureCode(error: unknown): FailureCode {
  return error instanceof FrictionFailure ? error.code : "internal_error";
}

async function executeRequest(
  request: Exclude<ParsedRequest, { kind: "help" | "version" | "schema" }>,
  stdin: Readable,
): Promise<CommandExecution> {
  switch (request.kind) {
    case "add":
      return executeAdd(request, stdin);
    case "list":
      return executeList(request);
    case "stats":
      return executeStats(request);
    case "resolve":
    case "reopen":
      return executeLifecycle(request);
    case "export":
      return executeExport(request);
    case "publish":
      return executePublish(request);
    case "purge":
      return executePurge(request);
    case "doctor":
      return executeDoctor();
    case "setup":
      return executeSetup(request);
  }
}

export async function runCli(
  arguments_: readonly string[],
  io: CliIo,
): Promise<number> {
  const initialCommand = commandName(arguments_);
  const json = wantsJson(arguments_);

  try {
    const request = parseRequest(arguments_);

    if (request.kind === "help") {
      writeHelp(io.stdout, request.command);
      return 0;
    }

    if (request.kind === "version") {
      io.stdout.write(`${CLI_VERSION}\n`);
      return 0;
    }

    if (request.kind === "schema") {
      writeJsonSuccess(io.stdout, "schema", currentSchema(), []);
      return 0;
    }

    const result = await executeRequest(request, io.stdin);

    if (request.json) {
      writeJsonSuccess(io.stdout, result.command, result.data, result.warnings);
    } else {
      io.stdout.write(result.human);

      for (const warning of result.warnings) {
        io.stderr.write(`Warning: ${warning.message}\n`);
      }
    }

    return result.exitCode ?? 0;
  } catch (error) {
    const code = failureCode(error);

    if (json) {
      writeJsonError(io.stdout, initialCommand, code);
    } else {
      writeHumanError(io.stderr, code);
    }

    return errorRegistry[code].exitCode;
  }
}
