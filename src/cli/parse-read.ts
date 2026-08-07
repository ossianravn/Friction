import { parseArgs } from "node:util";

import type { ParsedRequest } from "./requests.js";

type ReadCommand = "list" | "stats" | "export";

export function parseReadCommand(
  command: ReadCommand,
  arguments_: readonly string[],
): ParsedRequest {
  const options = {
    repo: { type: "string" as const },
    since: { type: "string" as const },
    status: { type: "string" as const },
    json: { type: "boolean" as const },
    help: { type: "boolean" as const },
    version: { type: "boolean" as const },
    ...(command === "list" ? { limit: { type: "string" as const } } : {}),
    ...(command === "export"
      ? {
          format: { type: "string" as const },
          output: { type: "string" as const },
          force: { type: "boolean" as const },
        }
      : {}),
  };
  const parsed = parseArgs({
    args: [...arguments_],
    allowPositionals: false,
    strict: true,
    options,
  });

  if (parsed.values["version"] === true) {
    return { kind: "version" };
  }

  if (parsed.values["help"] === true) {
    return { kind: "help", command };
  }

  const filters = {
    repo: parsed.values["repo"] as string | undefined,
    since: parsed.values["since"] as string | undefined,
    status: parsed.values["status"] as string | undefined,
  };

  if (command === "list") {
    return {
      kind: "list",
      json: parsed.values["json"] ?? false,
      limit: parsed.values["limit"] as string | undefined,
      ...filters,
    };
  }

  if (command === "stats") {
    return {
      kind: "stats",
      json: parsed.values["json"] ?? false,
      ...filters,
    };
  }

  return {
    kind: "export",
    json: parsed.values["json"] ?? false,
    format: parsed.values["format"] as string | undefined,
    output: parsed.values["output"] as string | undefined,
    force: (parsed.values["force"] as boolean | undefined) ?? false,
    ...filters,
  };
}
