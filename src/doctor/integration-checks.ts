import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import { integrationById } from "../integrations/catalog.js";
import {
  isIntegrationId,
  type IntegrationId,
} from "../integrations/types.js";
import { buildSetupPlan } from "../setup/plan.js";
import type { DoctorCheck } from "./checks.js";

function targetLabel(targetPath: string): string {
  const base = path.basename(targetPath);
  return base === "SKILL.md" ? path.basename(path.dirname(targetPath)) : base;
}

async function plannedCheck(
  integration: IntegrationId,
  cwd: string,
  explicit: boolean,
): Promise<DoctorCheck | null> {
  const definition = integrationById(integration);
  const scope = definition.defaultScope;

  try {
    const plan = await buildSetupPlan({
      integration,
      scope,
      undo: false,
      cwd,
      workspace: scope === "workspace" ? cwd : undefined,
      source: undefined,
      transport: undefined,
    });
    const appearsConfigured =
      plan.targets.some(
        (target) =>
          target.snapshot.exists &&
          (target.kind === "managed-block" ||
            path.basename(target.path) === "friction.md"),
      );

    if (!explicit && !appearsConfigured) {
      return null;
    }

    const conflict = plan.targets.some((target) => target.state === "conflict");
    const current = plan.targets.every((target) => target.state === "noop");
    const targets = [...new Set(plan.targets.map((target) => targetLabel(target.path)))];
    const targetSummary = targets.length === 0
      ? "no managed file target"
      : `targets: ${targets.join(", ")}`;
    const retention = (
      ["codex", "opencode", "pi", "warp"] as readonly IntegrationId[]
    ).includes(integration)
      ? " Shared skills use the separate skills lifecycle."
      : "";
    const caveat = ` ${definition.caveats.join(" ")}`;

    if (conflict) {
      return {
        name: `setup-${integration}`,
        status: "warn",
        message: `${definition.label} has a setup conflict; ${targetSummary}.${retention}${caveat}`,
      };
    }

    if (plan.manualSteps.length > 0) {
      return {
        name: `setup-${integration}`,
        status: "warn",
        message: `${definition.label} requires a manual capture step; ${targetSummary}.${retention}${caveat}`,
      };
    }

    return {
      name: `setup-${integration}`,
      status: current ? "ok" : "warn",
      message: current
        ? `${definition.label} setup is current; ${targetSummary}.${retention}${caveat}`
        : `${definition.label} setup is incomplete; ${targetSummary}.${retention}${caveat}`,
    };
  } catch (error) {
    if (error instanceof FrictionFailure) {
      return explicit
        ? {
            name: `setup-${integration}`,
            status: "warn",
            message: `${definition.label} setup state is unavailable.`,
          }
        : null;
    }

    throw error;
  }
}

export async function integrationChecks(
  requested: string | undefined,
  cwd: string,
): Promise<DoctorCheck[]> {
  if (requested !== undefined) {
    if (!isIntegrationId(requested)) {
      throw new FrictionFailure("invalid_input");
    }

    const check = await plannedCheck(requested, cwd, true);
    return check === null ? [] : [check];
  }

  const checks = await Promise.all(
    (["codex", "claude-code", "opencode", "pi"] as const).map(
      (integration) => plannedCheck(integration, cwd, false),
    ),
  );
  return checks.filter((check): check is DoctorCheck => check !== null);
}
