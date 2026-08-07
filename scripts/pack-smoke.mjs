import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

async function run(command, arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: options.cwd ?? repositoryRoot,
      env: options.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const result = {
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };

      if (code === 0) {
        resolve(result);
      } else {
        reject(new Error(`${command} exited ${code}: ${result.stderr}`));
      }
    });
    child.stdin.end(options.input ?? "");
  });
}

const temporaryRoot = await mkdtemp(path.join(tmpdir(), "friction-pack-smoke-"));

try {
  const tarballDirectory = path.join(temporaryRoot, "tarball");
  const installDirectory = path.join(temporaryRoot, "install");
  const privateHome = path.join(temporaryRoot, "private");
  const userHome = path.join(temporaryRoot, "user");
  const workingDirectory = path.join(temporaryRoot, "work");
  await mkdir(tarballDirectory);
  await mkdir(installDirectory);
  await mkdir(userHome);
  await mkdir(workingDirectory);
  const npmEnvironment = {
    ...process.env,
    npm_config_cache: path.join(temporaryRoot, "npm-cache"),
  };

  await run("npm", ["run", "build"], { env: npmEnvironment });
  await run("npm", ["pack", "--silent", "--pack-destination", tarballDirectory], {
    env: npmEnvironment,
  });
  const tarballs = (await readdir(tarballDirectory)).filter((name) => name.endsWith(".tgz"));
  assert.equal(tarballs.length, 1);
  const tarballPath = path.join(tarballDirectory, tarballs[0]);
  await run(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-save", tarballPath],
    { cwd: installDirectory, env: npmEnvironment },
  );

  const packageRoot = path.join(installDirectory, "node_modules", "friction");
  const binary = path.join(installDirectory, "node_modules", ".bin", "friction");
  await access(path.join(packageRoot, "assets", "instructions", "capture.md"));
  await access(path.join(packageRoot, "skills", "friction-review", "SKILL.md"));
  await access(path.join(packageRoot, "skills", "friction-fix", "SKILL.md"));

  const environment = {
    ...process.env,
    HOME: userHome,
    FRICTION_HOME: privateHome,
  };
  const version = await run(binary, ["--version"], { cwd: workingDirectory, env: environment });
  assert.equal(version.stdout.trim(), "0.0.0");
  const body = "Packaged capture found an undocumented working-directory assumption.";
  const added = await run(
    binary,
    ["add", "--stdin", "--source", "generic", "--json"],
    { cwd: workingDirectory, env: environment, input: `${body}\n` },
  );
  assert.equal(added.stdout.includes(body), false);
  assert.equal(JSON.parse(added.stdout).ok, true);
  const listed = await run(binary, ["list", "--status", "all", "--json"], {
    cwd: workingDirectory,
    env: environment,
  });
  const listEnvelope = JSON.parse(listed.stdout);
  assert.equal(listEnvelope.ok, true);
  assert.equal(listEnvelope.data.count, 1);
  assert.equal(listEnvelope.data.records[0].body, body);
  console.log("Package smoke passed: tarball assets, version, and separate add/list processes.");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
