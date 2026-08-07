import { parseArgs } from "node:util";

import { FrictionFailure } from "../domain/failures.js";
import type { ParsedRequest } from "./requests.js";

export function parsePublish(arguments_: readonly string[]): ParsedRequest {
  const parsed = parseArgs({
    args: [...arguments_],
    allowPositionals: true,
    strict: true,
    options: {
      "all-open": { type: "boolean" },
      output: { type: "string" },
      apply: { type: "boolean" },
      json: { type: "boolean" },
      help: { type: "boolean" },
      version: { type: "boolean" },
    },
  });

  if (parsed.values["version"] === true) {
    return { kind: "version" };
  }

  if (parsed.values["help"] === true) {
    return { kind: "help", command: "publish" };
  }

  const allOpen = parsed.values["all-open"] ?? false;

  if (allOpen === (parsed.positionals.length > 0)) {
    throw new FrictionFailure("invalid_input");
  }

  return {
    kind: "publish",
    json: parsed.values["json"] ?? false,
    ids: parsed.positionals,
    allOpen,
    output: parsed.values["output"],
    apply: parsed.values["apply"] ?? false,
  };
}
