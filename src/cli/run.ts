import type { Readable } from "node:stream";

import { FrictionFailure, type FailureCode } from "../domain/failures.js";
import type { HumanRenderOptions } from "../views/presentation.js";
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
import { commandContract, commandNames } from "./contract.js";
import { errorRegistry } from "./errors.js";
import {
  writeHumanError,
  writeJsonError,
  writeJsonSuccess,
  type CommandName,
} from "./output.js";
import { parseRequest } from "./parse.js";
import { humanRenderOptions } from "./presentation.js";
import type { ImplementedCommand, ParsedRequest } from "./requests.js";
import { currentSchema } from "./schema.js";

type WritableOutput = {
  write(value: string): unknown;
};

type HumanOutput = WritableOutput & {
  isTTY?: boolean;
  columns?: number;
};

export type CliIo = {
  stdin: Readable;
  stdout: HumanOutput;
  stderr: WritableOutput;
  environment: NodeJS.ProcessEnv;
};

function commandName(arguments_: readonly string[]): CommandName {
  const command = arguments_[0];
  return command !== undefined && commandNames.includes(command as ImplementedCommand)
    ? (command as ImplementedCommand)
    : "unknown";
}

function wantsJson(arguments_: readonly string[]): boolean {
  return arguments_.includes("--json");
}

function writeHelp(output: WritableOutput, command: ImplementedCommand | null): void {
  if (command !== null) {
    const contract = commandContract[command];
    const options = contract.options.length === 0
      ? ""
      : `\nOptions:\n${contract.options
          .map((option) => `  ${option.name}\n      ${option.description}`)
          .join("\n")}\n`;
    output.write(
      `${contract.purpose}\n\nUsage:\n${contract.syntax.map((syntax) => `  ${syntax}`).join("\n")}${options}\nNotes:\n${contract.notes.map((note) => `  ${note}`).join("\n")}\n`,
    );
    return;
  }

  output.write(
    `Friction is a local-first feedback loop for coding agents.\n\nUsage: friction <command> [options]\n\nCommands:\n${commandNames
      .map((name) => `  ${name.padEnd(8)} ${commandContract[name].purpose}`)
      .join("\n")}\n\nCommon options: --help, --version, --json\n\nPlatforms: macOS, Linux, WSL, and native Windows 11 x64.\nRun friction schema for the machine-readable platform, privacy, and side-effect contract.\n`,
  );
}

function failureCode(error: unknown): FailureCode {
  return error instanceof FrictionFailure ? error.code : "internal_error";
}

async function executeRequest(
  request: Exclude<ParsedRequest, { kind: "help" | "version" | "schema" }>,
  stdin: Readable,
  presentation: HumanRenderOptions,
): Promise<CommandExecution> {
  switch (request.kind) {
    case "add":
      return executeAdd(request, stdin);
    case "list":
      return executeList(request, presentation);
    case "stats":
      return executeStats(request, presentation);
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
      return executeDoctor(presentation, request);
    case "setup":
    case "setup-list":
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

    const presentation = humanRenderOptions(io.stdout, io.environment);
    const result = await executeRequest(request, io.stdin, presentation);

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
