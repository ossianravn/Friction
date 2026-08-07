import { exportObservations } from "../../views/export-service.js";
import type { ParsedRequest } from "../requests.js";
import { warningsFromQuery } from "../warnings.js";
import type { CommandExecution } from "./types.js";

type ExportRequest = Extract<ParsedRequest, { kind: "export" }>;

export async function executeExport(
  request: ExportRequest,
): Promise<CommandExecution> {
  const result = await exportObservations(request);
  const data = {
    scope: result.scope,
    format: result.format,
    outputPath: result.outputPath,
    recordCount: result.recordCount,
    markdown: result.markdown,
    jsonl: result.jsonl,
  };

  return {
    command: "export",
    data,
    human:
      result.outputPath === null
        ? result.rendered
        : `Exported ${result.recordCount} observations to ${result.outputPath}.\n`,
    warnings: warningsFromQuery(result.warnings),
  };
}
