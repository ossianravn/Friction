import path from "node:path";

import type { RawReadFilters } from "../domain/filters.js";
import { FrictionFailure } from "../domain/failures.js";
import { writeOutputFile } from "../platform/fs.js";
import { renderExport, type ExportFormat } from "./export.js";
import { toPublicRecord } from "./public-record.js";
import { queryRecords, type QueryWarnings, type ScopeDisplay } from "./query.js";

export type ExportInput = RawReadFilters & {
  format: string | undefined;
  output: string | undefined;
  force: boolean;
};

export type ExportResult = {
  scope: ScopeDisplay;
  format: ExportFormat;
  outputPath: string | null;
  recordCount: number;
  markdown: string | null;
  jsonl: string | null;
  rendered: string;
  warnings: QueryWarnings;
};

export async function exportObservations(input: ExportInput): Promise<ExportResult> {
  const format = input.format ?? "markdown";

  if (format !== "markdown" && format !== "jsonl") {
    throw new FrictionFailure("invalid_input");
  }

  if (input.force && input.output === undefined) {
    throw new FrictionFailure("invalid_input");
  }

  const query = await queryRecords(input);
  const records = query.records.map(toPublicRecord);
  const rendered = renderExport(format, query.scope, records);
  let outputPath: string | null = null;

  if (input.output !== undefined) {
    outputPath = path.resolve(input.output);

    try {
      await writeOutputFile(outputPath, Buffer.from(rendered, "utf8"), input.force);
    } catch (error) {
      if (error instanceof FrictionFailure) {
        throw error;
      }

      if (error instanceof Error && error.message === "output-conflict") {
        throw new FrictionFailure("output_conflict");
      }

      throw new FrictionFailure("io_error");
    }
  }

  return {
    scope: query.scope,
    format,
    outputPath,
    recordCount: records.length,
    markdown: outputPath === null && format === "markdown" ? rendered : null,
    jsonl: outputPath === null && format === "jsonl" ? rendered : null,
    rendered,
    warnings: query.warnings,
  };
}
