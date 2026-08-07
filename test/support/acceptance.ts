import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { runFriction, type ProcessResult } from "./process.js";

export type Envelope = {
  ok: boolean;
  data: Record<string, unknown>;
  warnings: Array<Record<string, unknown>>;
};

export function envelope(result: ProcessResult): Envelope {
  assert.equal(result.stdout.endsWith("\n"), true);
  assert.equal(result.stdout.trim().split("\n").length, 1);
  return JSON.parse(result.stdout) as Envelope;
}

export async function makeAcceptanceFixture(prefix: string): Promise<{
  root: string;
  home: string;
  work: string;
}> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  const work = path.join(root, "work");
  await mkdir(work);
  return { root, home: path.join(root, "home"), work };
}

export async function addObservation(
  home: string,
  cwd: string,
  body: string,
): Promise<string> {
  const result = await runFriction({
    arguments: ["add", "--stdin", "--source", "codex", "--json"],
    cwd,
    home,
    stdin: body,
  });
  assert.equal(result.code, 0);
  return envelope(result).data["observationId"] as string;
}

export async function eventNames(home: string): Promise<string[]> {
  return readdir(path.join(home, "v1", "events"));
}
