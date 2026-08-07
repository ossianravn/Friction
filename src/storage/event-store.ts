import { mkdir } from "node:fs/promises";
import path from "node:path";

import { isFrictionEvent } from "../domain/event-validation.js";
import type { FrictionEvent } from "../domain/events.js";
import { FrictionFailure } from "../domain/failures.js";
import { installPrivateFileExclusively } from "../platform/fs.js";
import { createEventId } from "../platform/ids.js";
import {
  rejectSymlinkedHome,
  rejectUnsafeStoreDirectory,
  type FrictionPaths,
} from "./paths.js";

async function ensureStoreDirectories(paths: FrictionPaths): Promise<void> {
  await rejectSymlinkedHome(paths.home);
  await mkdir(paths.home, { recursive: true, mode: 0o700 });
  await rejectSymlinkedHome(paths.home);
  const versionDirectory = path.dirname(paths.events);
  await rejectUnsafeStoreDirectory(versionDirectory);
  await mkdir(versionDirectory, { recursive: true, mode: 0o700 });
  await rejectUnsafeStoreDirectory(versionDirectory);
  await rejectUnsafeStoreDirectory(paths.events);
  await rejectUnsafeStoreDirectory(paths.temporary);
  await Promise.all([
    mkdir(paths.events, { recursive: true, mode: 0o700 }),
    mkdir(paths.temporary, { recursive: true, mode: 0o700 }),
  ]);
  await rejectUnsafeStoreDirectory(paths.events);
  await rejectUnsafeStoreDirectory(paths.temporary);
}

function serialize(event: FrictionEvent): Uint8Array {
  if (!isFrictionEvent(event)) {
    throw new FrictionFailure("safety_failure");
  }

  return Buffer.from(`${JSON.stringify(event, null, 2)}\n`, "utf8");
}

export async function writeEvent(
  paths: FrictionPaths,
  event: FrictionEvent,
  nextEventId: () => string = createEventId,
): Promise<FrictionEvent> {
  try {
    await ensureStoreDirectories(paths);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const candidate =
        attempt === 0 ? event : { ...event, eventId: nextEventId() };
      const finalPath = path.join(paths.events, `${candidate.eventId}.json`);
      const result = await installPrivateFileExclusively(
        paths.temporary,
        finalPath,
        serialize(candidate),
      );

      if (result === "installed") {
        return candidate;
      }
    }
  } catch (error) {
    if (error instanceof FrictionFailure) {
      throw error;
    }

    throw new FrictionFailure("io_error");
  }

  throw new FrictionFailure("io_error");
}
