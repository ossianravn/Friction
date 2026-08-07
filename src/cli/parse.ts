import { parseArgs } from "node:util";

import { FrictionFailure } from "../domain/failures.js";
import { parseLifecycleCommand } from "./parse-lifecycle.js";
import { parsePublish } from "./parse-publish.js";
import { parseReadCommand } from "./parse-read.js";
import { parseSetup } from "./parse-setup.js";
import type { ParsedRequest } from "./requests.js";

function parseAdd(arguments_: readonly string[]): ParsedRequest {
  const parsed = parseArgs({
    args: [...arguments_],
    allowPositionals: true,
    strict: true,
    options: {
      stdin: { type: "boolean" },
      source: { type: "string" },
      model: { type: "string" },
      area: { type: "string" },
      impact: { type: "string", multiple: true },
      json: { type: "boolean" },
      help: { type: "boolean" },
      version: { type: "boolean" },
    },
  });

  if (parsed.values["version"] === true) {
    return { kind: "version" };
  }

  if (parsed.values["help"] === true) {
    return { kind: "help", command: "add" };
  }

  if (parsed.positionals.length > 1) {
    throw new FrictionFailure("invalid_input");
  }

  return {
    kind: "add",
    json: parsed.values["json"] ?? false,
    positionalBody: parsed.positionals[0] ?? null,
    stdin: parsed.values["stdin"] ?? false,
    source: parsed.values["source"],
    model: parsed.values["model"],
    area: parsed.values["area"],
    impacts: parsed.values["impact"] ?? [],
  };
}

function parseSimple(
  command: "doctor" | "schema",
  arguments_: readonly string[],
): ParsedRequest {
  const parsed = parseArgs({
    args: [...arguments_],
    allowPositionals: false,
    strict: true,
    options: {
      json: { type: "boolean" },
      help: { type: "boolean" },
      version: { type: "boolean" },
    },
  });

  if (parsed.values["version"] === true) {
    return { kind: "version" };
  }

  if (parsed.values["help"] === true) {
    return { kind: "help", command };
  }

  return command === "doctor"
    ? { kind: "doctor", json: parsed.values["json"] ?? false }
    : { kind: "schema" };
}

export function parseRequest(arguments_: readonly string[]): ParsedRequest {
  try {
    if (arguments_.length === 0 || arguments_[0] === "--help") {
      return { kind: "help", command: null };
    }

    if (arguments_[0] === "--version") {
      return { kind: "version" };
    }

    const command = arguments_[0];

    if (command === "add") {
      return parseAdd(arguments_.slice(1));
    }

    if (command === "list" || command === "stats" || command === "export") {
      return parseReadCommand(command, arguments_.slice(1));
    }

    if (command === "resolve" || command === "reopen" || command === "purge") {
      return parseLifecycleCommand(command, arguments_.slice(1));
    }

    if (command === "publish") {
      return parsePublish(arguments_.slice(1));
    }

    if (command === "doctor" || command === "schema") {
      return parseSimple(command, arguments_.slice(1));
    }

    if (command === "setup") {
      return parseSetup(arguments_.slice(1));
    }

    throw new FrictionFailure("invalid_input");
  } catch (error) {
    if (error instanceof FrictionFailure) {
      throw error;
    }

    throw new FrictionFailure("invalid_input");
  }
}
