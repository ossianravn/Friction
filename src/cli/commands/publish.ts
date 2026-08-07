import { applyPublishPlan } from "../../publish/apply.js";
import { buildPublishPlan, publishData } from "../../publish/service.js";
import type { ParsedRequest } from "../requests.js";
import type { CommandExecution } from "./types.js";

type PublishRequest = Extract<ParsedRequest, { kind: "publish" }>;

export async function executePublish(
  request: PublishRequest,
): Promise<CommandExecution> {
  const plan = await buildPublishPlan(request);

  if (request.apply) {
    await applyPublishPlan(plan);
  }

  const data = publishData(plan, request.apply);
  const lines = [
    `${data.action} publish: ${data.state} ${data.target}`,
    `Selected ${data.selectedIds.length}; creates ${data.creates}; updates ${data.updates}; unchanged ${data.unchanged}.`,
    ...data.selected.map(
      (record) => `${record.observationId} [${record.status}] ${record.summary}`,
    ),
  ];

  return {
    command: "publish",
    data,
    human: `${lines.join("\n")}\n`,
    warnings: [],
  };
}
