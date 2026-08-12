import { parseArgs } from "node:util";

import { FrictionFailure } from "../domain/failures.js";
import type { ParsedRequest } from "./requests.js";

export function parseSetup(arguments_: readonly string[]): ParsedRequest {
  const parsed = parseArgs({
    args: [...arguments_],
    allowPositionals: true,
    strict: true,
    options: {
      list: { type: "boolean" },
      scope: { type: "string" },
      workspace: { type: "string" },
      source: { type: "string" },
      shell: { type: "string" },
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

  if (parsed.values["list"] === true) {
    if (
      parsed.positionals.length !== 0 ||
      parsed.values["apply"] === true ||
      parsed.values["undo"] === true ||
      parsed.values["scope"] !== undefined ||
      parsed.values["workspace"] !== undefined ||
      parsed.values["source"] !== undefined ||
      parsed.values["shell"] !== undefined
    ) {
      throw new FrictionFailure("invalid_input");
    }

    return { kind: "setup-list", json: parsed.values["json"] ?? false };
  }

  if (parsed.positionals.length !== 1) {
    throw new FrictionFailure("invalid_input");
  }

  return {
    kind: "setup",
    json: parsed.values["json"] ?? false,
    integration: parsed.positionals[0]!,
    scope: parsed.values["scope"],
    workspace: parsed.values["workspace"],
    source: parsed.values["source"],
    shell: parsed.values["shell"],
    apply: parsed.values["apply"] ?? false,
    undo: parsed.values["undo"] ?? false,
  };
}
