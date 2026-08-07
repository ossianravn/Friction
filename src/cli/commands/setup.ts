import { runSetup } from "../../setup/service.js";
import type { ParsedRequest } from "../requests.js";
import type { CliWarning } from "../output.js";
import type { CommandExecution } from "./types.js";

type SetupRequest = Extract<ParsedRequest, { kind: "setup" }>;

const pathWarning: CliWarning = {
  code: "path_unavailable",
  message: "friction is not discoverable on PATH; setup did not install it.",
};

export async function executeSetup(
  request: SetupRequest,
): Promise<CommandExecution> {
  const result = await runSetup(request);
  const lines = [
    `${result.data.action} ${result.data.harness} (${result.data.scope}): ${result.data.state}`,
    ...result.data.mutations.map(
      (mutation) => `${mutation.state} ${mutation.kind} ${mutation.path}`,
    ),
  ];

  if (result.data.snippet !== null) {
    lines.push(result.data.snippet);
  }

  return {
    command: "setup",
    data: result.data,
    human: `${lines.join("\n")}\n`,
    warnings: result.pathWarning ? [pathWarning] : [],
  };
}
