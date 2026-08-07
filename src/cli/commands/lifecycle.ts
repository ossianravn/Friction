import { changeLifecycle } from "../../lifecycle/service.js";
import type { ParsedRequest } from "../requests.js";
import { warningsFromCounts } from "../warnings.js";
import type { CommandExecution } from "./types.js";

type LifecycleRequest = Extract<ParsedRequest, { kind: "resolve" | "reopen" }>;

export async function executeLifecycle(
  request: LifecycleRequest,
): Promise<CommandExecution> {
  const receipt = await changeLifecycle({
    action: request.kind,
    observationId: request.observationId,
    note: request.note,
    verification: request.verification,
    source: request.source,
  });

  return {
    command: request.kind,
    data: {
      observationId: receipt.observationId,
      changed: receipt.changed,
      status: receipt.status,
      lifecycleEventId: receipt.lifecycleEventId,
    },
    human: `${receipt.observationId} is ${receipt.status}${receipt.changed ? "." : " (unchanged)."}\n`,
    warnings: warningsFromCounts(receipt),
  };
}
