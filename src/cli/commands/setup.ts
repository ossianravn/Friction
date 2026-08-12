import {
  runSetup,
  setupCatalogData,
} from "../../setup/service.js";
import type { ParsedRequest } from "../requests.js";
import type { CliWarning } from "../output.js";
import type { CommandExecution } from "./types.js";

type SetupRequest = Extract<
  ParsedRequest,
  { kind: "setup" | "setup-list" }
>;

const pathWarning: CliWarning = {
  code: "path_unavailable",
  message: "friction is not discoverable on PATH; setup did not install it.",
};

export async function executeSetup(
  request: SetupRequest,
): Promise<CommandExecution> {
  if (request.kind === "setup-list") {
    const data = setupCatalogData();
    const lines = data.integrations.flatMap((entry) => [
      `${entry.id.padEnd(12)} ${entry.label} [${entry.supportedScopes.join(", ")}]`,
      ...entry.capabilities.map(
        (capability) =>
          `  ${capability.scope}: capture ${capability.capture}, skills ${capability.skills}, ${capability.support}`,
      ),
      ...entry.caveats.map((caveat) => `  Note: ${caveat}`),
    ]);
    return {
      command: "setup",
      data,
      human: `Friction integrations\n\n${lines.join("\n")}\n`,
      warnings: [],
    };
  }

  const result = await runSetup(request);
  const lines = [
    `${result.data.action} ${result.data.integration} (${result.data.scope}): ${result.data.state}`,
    `ready: ${result.data.ready ? "yes" : "no"}`,
    ...result.data.mutations.map(
      (mutation) => `${mutation.state} ${mutation.kind} ${mutation.path}`,
    ),
    ...result.data.manualSteps.map((step) => `manual: ${step}`),
  ];

  if (result.data.snippet !== null) {
    lines.push(result.data.snippet);
  }

  return {
    command: "setup",
    data: result.data,
    human: `${lines.join("\n")}\n`,
    warnings: [
      ...result.warnings,
      ...(result.pathWarning ? [pathWarning] : []),
    ],
  };
}
