import { parseArgs } from "node:util";

import { FrictionFailure } from "../domain/failures.js";
import type { ParsedRequest } from "./requests.js";

export function parseSetup(arguments_: readonly string[]): ParsedRequest {
  const parsed = parseArgs({
    args: [...arguments_],
    allowPositionals: true,
    strict: true,
    options: {
      scope: { type: "string" },
      apply: { type: "boolean" },
      undo: { type: "boolean" },
      json: { type: "boolean" },
      help: { type: "boolean" },
      version: { type: "boolean" },
    },
  });

  if (parsed.values["version"] === true) {
    return { kind: "version" };
  }

  if (parsed.values["help"] === true) {
    return { kind: "help", command: "setup" };
  }

  if (parsed.positionals.length !== 1) {
    throw new FrictionFailure("invalid_input");
  }

  return {
    kind: "setup",
    json: parsed.values["json"] ?? false,
    harness: parsed.positionals[0]!,
    scope: parsed.values["scope"],
    apply: parsed.values["apply"] ?? false,
    undo: parsed.values["undo"] ?? false,
  };
}
