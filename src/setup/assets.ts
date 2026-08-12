import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import type { Source } from "../domain/source.js";
import type { CaptureTransport } from "../integrations/types.js";

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));

export type SkillAsset = {
  assetId: string;
  relativePath: string;
  bytes: Buffer;
};

export type SetupAssets = {
  captureShared: string;
  capturePosix: string;
  capturePowerShell: string;
  skills: SkillAsset[];
};

async function readDirectory(
  directory: string,
  relativeDirectory: string = "",
): Promise<SkillAsset[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const assets: SkillAsset[] = [];

  for (const entry of entries.sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  )) {
    const relativePath = path.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      assets.push(...(await readDirectory(absolutePath, relativePath)));
    } else if (entry.isFile()) {
      assets.push({
        assetId: relativePath.split(path.sep).join("/"),
        relativePath,
        bytes: await readFile(absolutePath),
      });
    }
  }

  return assets;
}

export async function loadSetupAssets(): Promise<SetupAssets> {
  const instructionRoot = path.join(packageRoot, "assets", "instructions");
  const [captureShared, capturePosix, capturePowerShell] = await Promise.all([
    readFile(path.join(instructionRoot, "capture-shared.md"), "utf8"),
    readFile(path.join(instructionRoot, "capture-posix.md"), "utf8"),
    readFile(path.join(instructionRoot, "capture-powershell.md"), "utf8"),
  ]);
  const skills: SkillAsset[] = [];

  for (const skillName of ["friction-review", "friction-fix"] as const) {
    const skillRoot = path.join(packageRoot, "skills", skillName);
    const files = await readDirectory(skillRoot);

    for (const file of files) {
      skills.push({
        assetId: `${skillName}/${file.assetId}`,
        relativePath: path.join(skillName, file.relativePath),
        bytes: file.bytes,
      });
    }
  }

  return { captureShared, capturePosix, capturePowerShell, skills };
}

export function captureInstruction(
  assets: SetupAssets,
  source: Source,
  transport: CaptureTransport,
): Buffer {
  const command = captureCommand(assets, source, transport);
  return Buffer.from(assets.captureShared.replace("{{COMMAND}}", command), "utf8");
}

function captureCommand(
  assets: SetupAssets,
  source: Source,
  transport: CaptureTransport,
): string {
  if (transport === "portable") {
    return [
      "Use the form for the current shell:",
      "",
      "POSIX shells:",
      captureCommand(assets, source, "posix"),
      "",
      "PowerShell:",
      captureCommand(assets, source, "powershell"),
    ].join("\n");
  }

  const template =
    transport === "powershell" ? assets.capturePowerShell : assets.capturePosix;
  return template.replaceAll("{{SOURCE}}", source).trimEnd();
}

export function genericCaptureSnippet(
  assets: SetupAssets,
  source: Source,
  transport: CaptureTransport,
): string {
  const guidance = captureInstruction(assets, source, transport)
    .toString("utf8")
    .trimEnd();
  const skills = `Skills: ${packagedSkillPaths().join(", ")}`;
  return [
    guidance,
    skills,
    "Runtime: install and run friction in the same environment as the agent.",
  ].join("\n");
}

export function packagedSkillPaths(): string[] {
  return [
    path.join(packageRoot, "skills", "friction-review"),
    path.join(packageRoot, "skills", "friction-fix"),
  ];
}
