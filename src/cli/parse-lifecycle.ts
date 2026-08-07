import { parseArgs } from "node:util";

import { FrictionFailure } from "../domain/failures.js";
import type { ParsedRequest } from "./requests.js";

export function parseLifecycleCommand(
  command: "resolve" | "reopen" | "purge",
  arguments_: readonly string[],
): ParsedRequest {
  const options =
    command === "purge"
      ? {
          apply: { type: "boolean" as const },
          json: { type: "boolean" as const },
          help: { type: "boolean" as const },
          version: { type: "boolean" as const },
        }
      : {
          note: { type: "string" as const },
          source: { type: "string" as const },
          ...(command === "resolve"
            ? { verification: { type: "string" as const } }
            : {}),
          json: { type: "boolean" as const },
          help: { type: "boolean" as const },
          version: { type: "boolean" as const },
        };
  const parsed = parseArgs({
    args: [...arguments_],
    allowPositionals: true,
    strict: true,
    options,
  });
  const values = parsed.values as Record<string, string | boolean | undefined>;

  if (values["version"] === true) {
    return { kind: "version" };
  }

  if (values["help"] === true) {
    return { kind: "help", command };
  }

  if (parsed.positionals.length !== 1) {
    throw new FrictionFailure("invalid_input");
  }

  if (command === "purge") {
    return {
      kind: "purge",
      json: values["json"] === true,
      observationId: parsed.positionals[0]!,
      apply: values["apply"] === true,
    };
  }

  return {
    kind: command,
    json: values["json"] === true,
    observationId: parsed.positionals[0]!,
    note: typeof values["note"] === "string" ? values["note"] : undefined,
    verification:
      typeof values["verification"] === "string"
        ? values["verification"]
        : undefined,
    source: typeof values["source"] === "string" ? values["source"] : undefined,
  };
}
