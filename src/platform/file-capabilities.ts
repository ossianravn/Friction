import { randomUUID } from "node:crypto";
import { link, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { FileCapabilities } from "./capabilities.js";

function isCode(error: unknown, code: string): boolean {
  return error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === code;
}

export async function probeFileCapabilities(
  directory: string,
): Promise<FileCapabilities> {
  const key = randomUUID().replaceAll("-", "");
  const exclusive = path.join(directory, `${key}-exclusive.tmp`);
  const hardLink = path.join(directory, `${key}-hard-link.tmp`);
  const replaceTarget = path.join(directory, `${key}-replace-target.tmp`);
  const replacement = path.join(directory, `${key}-replacement.tmp`);
  const lock = path.join(directory, `${key}-lock.tmp`);
  const cleanup = [exclusive, hardLink, replaceTarget, replacement, lock];
  let exclusiveCreate = false;
  let hardLinkInstall = false;
  let replaceExisting = false;
  let lockFile = false;

  try {
    const exclusiveHandle = await open(exclusive, "wx", 0o600);
    await exclusiveHandle.close();
    exclusiveCreate = true;

    await link(exclusive, hardLink);
    hardLinkInstall = true;

    await writeFile(replaceTarget, "before", { flag: "wx", mode: 0o600 });
    await writeFile(replacement, "after", { flag: "wx", mode: 0o600 });
    await rename(replacement, replaceTarget);
    replaceExisting = (await readFile(replaceTarget, "utf8")) === "after";

    const lockHandle = await open(lock, "wx", 0o600);

    try {
      const unexpected = await open(lock, "wx", 0o600);
      await unexpected.close();
    } catch (error) {
      lockFile = isCode(error, "EEXIST");
    } finally {
      await lockHandle.close();
    }
  } catch {
    // Individual false capability facts are the safe result.
  } finally {
    for (const candidate of cleanup) {
      await unlink(candidate).catch(() => undefined);
    }
  }

  return { exclusiveCreate, hardLinkInstall, replaceExisting, lockFile };
}

export function allFileCapabilitiesAvailable(
  capabilities: FileCapabilities,
): boolean {
  return capabilities.exclusiveCreate &&
    capabilities.hardLinkInstall &&
    capabilities.replaceExisting &&
    capabilities.lockFile;
}
