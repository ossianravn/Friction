import { randomUUID } from "node:crypto";
import { lstat, open, readdir, unlink } from "node:fs/promises";
import path from "node:path";

import { foldEvents } from "../lifecycle/fold.js";
import { FrictionFailure } from "../domain/failures.js";
import { discoverRepository } from "../repository/discover.js";
import { executableOnPath } from "../platform/path.js";
import { resolveRuntimePlatform } from "../platform/runtime-platform.js";
import { redact } from "../security/redact.js";
import { buildSetupPlan } from "../setup/plan.js";
import type { SetupHarness } from "../setup/types.js";
import { loadEvents } from "../storage/load-events.js";
import { resolveFrictionPaths } from "../storage/paths.js";
import { verifyPrivateStoreFile } from "../storage/private-store.js";
import { CLI_VERSION } from "../version.js";
import { windowsPrivateStoreChecks } from "./windows-checks.js";

export type DoctorCheck = {
  name: string;
  status: "ok" | "warn" | "error";
  message: string;
};

function isMissing(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

async function pathCheck(name: string, target: string, privateMode: number): Promise<DoctorCheck> {
  try {
    const status = await lstat(target);

    if (status.isSymbolicLink()) {
      return { name, status: "error", message: `${name} is an unsupported symlink.` };
    }

    if (!status.isDirectory()) {
      return { name, status: "error", message: `${name} is not a directory.` };
    }

    if ((status.mode & 0o777) !== privateMode) {
      return { name, status: "warn", message: `${name} permissions are broader than expected.` };
    }

    return { name, status: "ok", message: `${name} permissions are private.` };
  } catch (error) {
    return isMissing(error)
      ? { name, status: "ok", message: `${name} does not exist yet.` }
      : { name, status: "error", message: `${name} is not readable.` };
  }
}

async function probeTemporaryDirectory(directory: string): Promise<DoctorCheck> {
  const probe = path.join(directory, `doctor-${randomUUID().replaceAll("-", "")}.tmp`);
  let handle;

  try {
    handle = await open(probe, "wx", 0o600);
    await verifyPrivateStoreFile(probe);
    await handle.close();
    handle = undefined;
    await unlink(probe);
    return { name: "temporary-write", status: "ok", message: "Private temp writes succeed." };
  } catch (error) {
    return isMissing(error)
      ? { name: "temporary-write", status: "warn", message: "Private temp directory does not exist yet." }
      : { name: "temporary-write", status: "error", message: "Private temp write probe failed." };
  } finally {
    await handle?.close().catch(() => undefined);
    await unlink(probe).catch(() => undefined);
  }
}

async function setupCheck(harness: SetupHarness, cwd: string): Promise<DoctorCheck> {
  const name = `setup-${harness}`;

  try {
    const plan = await buildSetupPlan({ harness, scope: "user", undo: false, cwd });
    const conflict = plan.targets.some((target) => target.state === "conflict");
    const installed = plan.targets.every((target) => target.state === "noop");

    if (conflict) {
      return { name, status: "warn", message: `${harness} setup has conflicting files.` };
    }

    return installed
      ? { name, status: "ok", message: `${harness} setup is current.` }
      : { name, status: "warn", message: `${harness} setup is not installed or is incomplete.` };
  } catch {
    return { name, status: "warn", message: `${harness} setup state is unavailable.` };
  }
}

export async function runDoctor(cwd: string = process.cwd()): Promise<DoctorCheck[]> {
  const platform = resolveRuntimePlatform();
  const paths = resolveFrictionPaths();
  const checks: DoctorCheck[] = [
    {
      name: "runtime",
      status: Number(process.versions.node.split(".")[0]) >= 24 ? "ok" : "error",
      message: `Node ${process.versions.node}; Friction ${CLI_VERSION}.`,
    },
    {
      name: "home-path",
      status: "ok",
      message: platform === "win32"
        ? "Private home is a validated local Windows path."
        : `Private home: ${paths.home}`,
    },
  ];
  if (platform === "win32") {
    const windows = await windowsPrivateStoreChecks(paths);
    checks.push(...windows.checks);

    if (!windows.safeToRead) {
      return checks;
    }
  } else {
    const home = await pathCheck("home", paths.home, 0o700);
    checks.push(home);

    if (home.status === "error") {
      return checks;
    }

    const eventsDirectory = await pathCheck("events-directory", paths.events, 0o700);
    const temporaryDirectory = await pathCheck("temporary-directory", paths.temporary, 0o700);
    checks.push(eventsDirectory, temporaryDirectory);

    if (eventsDirectory.status === "error" || temporaryDirectory.status === "error") {
      return checks;
    }
  }

  let loaded;

  try {
    loaded = await loadEvents(paths);
  } catch (error) {
    if (
      platform === "win32" &&
      error instanceof FrictionFailure &&
      error.code === "safety_failure"
    ) {
      checks.push({
        name: "event-store",
        status: "error",
        message: "Private event store layout is unsafe or unverifiable.",
      });
      return checks;
    }

    throw error;
  }
  const folded = foldEvents(loaded.events.map((entry) => entry.event));

  for (const finding of loaded.findings) {
    const safeName = redact(finding.fileName).text;
    checks.push({
      name: "event-health",
      status: "error",
      message: `${safeName}: ${finding.type}.`,
    });
  }

  for (const finding of folded.findings) {
    checks.push({
      name: "corpus-health",
      status: "error",
      message: `${finding.type} for ${finding.observationId}.`,
    });
  }

  if (platform !== "win32") {
    for (const entry of loaded.events) {
      const status = await lstat(path.join(paths.events, entry.fileName));

      if ((status.mode & 0o077) !== 0) {
        checks.push({
          name: "event-permissions",
          status: "warn",
          message: `${redact(entry.fileName).text}: permissions are broader than expected.`,
        });
      }
    }
  }

  checks.push({
    name: "event-count",
    status: "ok",
    message: `${loaded.events.length} valid events; ${folded.records.length} observations.`,
  });

  try {
    const temporaryEntries = await readdir(paths.temporary);

    if (temporaryEntries.length > 0) {
      checks.push({
        name: "temporary-files",
        status: "warn",
        message: `${temporaryEntries.length} leftover temporary files.`,
      });
    }
  } catch (error) {
    if (!isMissing(error)) {
      checks.push({ name: "temporary-files", status: "error", message: "Temp directory is unreadable." });
    }
  }

  checks.push(await probeTemporaryDirectory(paths.temporary));
  const repository = await discoverRepository(cwd);
  checks.push(
    repository.state !== "repository"
      ? {
          name: "repository",
          status: repository.state === "repository-unavailable" ? "warn" : "ok",
          message: repository.state === "repository-unavailable"
            ? "Repository attribution is unavailable."
            : "No current repository detected.",
        }
      : { name: "repository", status: "ok", message: `Current repository: ${repository.context.name}.` },
  );
  const discoverable = await executableOnPath("friction");
  checks.push({
    name: "path",
    status: discoverable ? "ok" : "warn",
    message: discoverable
      ? "friction is discoverable on PATH."
      : "friction is not discoverable on PATH.",
  });
  checks.push(await setupCheck("codex", cwd), await setupCheck("claude-code", cwd));
  return checks;
}
