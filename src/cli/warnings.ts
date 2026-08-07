import type { QueryWarnings } from "../views/query.js";
import {
  repositoryUnavailableWarning,
  type CliWarning,
} from "./output.js";

export function warningsFromCounts(input: {
  eventFindingCount: number;
  corpusFindingCount: number;
  repositoryWarning?: boolean;
}): CliWarning[] {
  const warnings: CliWarning[] = [];

  if (input.eventFindingCount > 0) {
    warnings.push({
      code: "event_findings",
      message: `${input.eventFindingCount} event-file findings were skipped or ignored.`,
    });
  }

  if (input.corpusFindingCount > 0) {
    warnings.push({
      code: "corpus_findings",
      message: `${input.corpusFindingCount} lifecycle findings were ignored.`,
    });
  }

  if (input.repositoryWarning === true) {
    warnings.push(repositoryUnavailableWarning);
  }

  return warnings;
}

export function warningsFromQuery(input: QueryWarnings): CliWarning[] {
  return warningsFromCounts(input);
}
