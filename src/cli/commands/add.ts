import type { Readable } from "node:stream";

import { readStdinBody } from "../../capture/input.js";
import { captureObservation } from "../../capture/service.js";
import { FrictionFailure } from "../../domain/failures.js";
import { repositoryUnavailableWarning } from "../output.js";
import type { ParsedRequest } from "../requests.js";
import type { CommandExecution } from "./types.js";

type AddRequest = Extract<ParsedRequest, { kind: "add" }>;

export async function executeAdd(
  request: AddRequest,
  stdin: Readable,
): Promise<CommandExecution> {
  if (
    (request.stdin && request.positionalBody !== null) ||
    (!request.stdin && request.positionalBody === null)
  ) {
    throw new FrictionFailure("invalid_input");
  }

  const body = request.stdin
    ? await readStdinBody(stdin)
    : (request.positionalBody ?? "");
  const receipt = await captureObservation({
    body,
    source: request.source,
    model: request.model,
    area: request.area,
    impacts: request.impacts,
  });
  const data = {
    observationId: receipt.observationId,
    createdAt: receipt.createdAt,
    source: receipt.source,
    repository: receipt.repository,
    redactionCount: receipt.redactionCount,
  };
  const repository = receipt.repository?.name ?? "none";

  return {
    command: "add",
    data,
    human: `Recorded ${receipt.observationId} at ${receipt.createdAt} (source: ${receipt.source}, repository: ${repository}, redactions: ${receipt.redactionCount}).\n`,
    warnings: receipt.repositoryWarning ? [repositoryUnavailableWarning] : [],
  };
}
