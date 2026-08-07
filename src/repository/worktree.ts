import { realpath } from "node:fs/promises";

import { FrictionFailure } from "../domain/failures.js";
import { runGit } from "../platform/git.js";

export async function requireWorktreeRoot(cwd: string): Promise<string> {
  const result = await runGit(["rev-parse", "--show-toplevel"], cwd);

  if (result.status !== "ok") {
    throw new FrictionFailure("not_found");
  }

  try {
    return await realpath(result.stdout.trim());
  } catch {
    throw new FrictionFailure("not_found");
  }
}
