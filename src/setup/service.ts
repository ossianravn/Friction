import { FrictionFailure } from "../domain/failures.js";
import { isSource } from "../domain/source.js";
import { integrationById, integrationCatalog } from "../integrations/catalog.js";
import {
  isCaptureTransport,
  isIntegrationId,
  isSetupScope,
} from "../integrations/types.js";
import { executableOnPath } from "../platform/path.js";
import { applySetupPlan } from "./apply.js";
import { buildSetupPlan, setupData } from "./plan.js";
import type { SetupData, SetupWarning } from "./types.js";

export type SetupInput = {
  integration: string;
  scope: string | undefined;
  workspace: string | undefined;
  source: string | undefined;
  shell: string | undefined;
  apply: boolean;
  undo: boolean;
};

export type SetupResult = {
  data: SetupData;
  pathWarning: boolean;
  warnings: SetupWarning[];
};

export function setupCatalogData() {
  return { integrations: integrationCatalog };
}

export async function runSetup(input: SetupInput): Promise<SetupResult> {
  if (!isIntegrationId(input.integration)) {
    throw new FrictionFailure("invalid_input");
  }

  const definition = integrationById(input.integration);
  const scopeValue = input.scope ?? definition.defaultScope;

  if (
    !isSetupScope(scopeValue) ||
    !definition.supportedScopes.includes(scopeValue)
  ) {
    throw new FrictionFailure("invalid_input");
  }

  if (
    (scopeValue === "workspace") !== (input.workspace !== undefined) ||
    (input.source !== undefined &&
      (input.integration !== "generic" || !isSource(input.source))) ||
    (input.shell !== undefined &&
      (input.integration !== "generic" || !isCaptureTransport(input.shell))) ||
    (input.integration === "generic" &&
      (input.scope !== undefined ||
        input.workspace !== undefined ||
        input.apply ||
        input.undo))
  ) {
    throw new FrictionFailure("invalid_input");
  }

  const plan = await buildSetupPlan({
    integration: input.integration,
    scope: scopeValue,
    undo: input.undo,
    cwd: process.cwd(),
    workspace: input.workspace,
    source: input.source,
    transport: input.shell,
  });

  if (input.apply) {
    await applySetupPlan(plan);
  }

  const data = setupData(plan, input.apply);
  const pathWarning = !(await executableOnPath("friction"));
  data.ready = data.ready && !pathWarning;

  return {
    data,
    pathWarning,
    warnings: plan.warnings,
  };
}
