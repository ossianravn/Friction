import { purgeObservation } from "../../lifecycle/purge.js";
import type { ParsedRequest } from "../requests.js";
import type { CliWarning } from "../output.js";
import type { CommandExecution } from "./types.js";

type PurgeRequest = Extract<ParsedRequest, { kind: "purge" }>;

const sharedCopiesWarning: CliWarning = {
  code: "shared_copies",
  message: "Exports, projections, commits, backups, and copies require manual cleanup.",
};

export async function executePurge(
  request: PurgeRequest,
): Promise<CommandExecution> {
  const receipt = await purgeObservation(request.observationId, request.apply);
  const action = receipt.applied ? "Purged" : "Would purge";

  return {
    command: "purge",
    data: receipt,
    human: `${action} ${receipt.observationId}: ${receipt.eventCount} private event files.\n`,
    warnings: [sharedCopiesWarning],
  };
}
