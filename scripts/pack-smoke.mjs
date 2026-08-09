import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  childEnvironment,
  createProcessRunner,
} from "./package-smoke-process.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const { run, runNpm } = createProcessRunner(repositoryRoot);
const packageManifest = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
assert.equal(typeof packageManifest.name, "string");
assert.equal(typeof packageManifest.version, "string");
const packageName = packageManifest.name;
const packageVersion = packageManifest.version;

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
  const npmEnvironment = childEnvironment({
    npm_config_cache: path.join(temporaryRoot, "npm-cache"),
    npm_config_dry_run: "false",
  });

  await runNpm(["run", "build"], { env: npmEnvironment });
  await runNpm(["pack", "--silent", "--pack-destination", tarballDirectory], {
    env: npmEnvironment,
  });
  const tarballs = (await readdir(tarballDirectory)).filter((name) => name.endsWith(".tgz"));
  assert.equal(tarballs.length, 1);
  const tarballPath = path.join(tarballDirectory, tarballs[0]);
  await runNpm(
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-save", tarballPath],
    { cwd: installDirectory, env: npmEnvironment },
  );

  const packageRoot = path.join(
    installDirectory,
    "node_modules",
    ...packageName.split("/"),
  );
  const binaryDirectory = path.join(installDirectory, "node_modules", ".bin");
  const binary = path.join(binaryDirectory, "friction");
  await access(path.join(packageRoot, "assets", "instructions", "capture-shared.md"));
  await access(path.join(packageRoot, "assets", "instructions", "capture-posix.md"));
  await access(path.join(packageRoot, "assets", "instructions", "capture-powershell.md"));
  await access(path.join(packageRoot, "skills", "friction-review", "SKILL.md"));
  await access(path.join(packageRoot, "skills", "friction-fix", "SKILL.md"));

  const environment = childEnvironment({
    HOME: userHome,
    USERPROFILE: userHome,
    LOCALAPPDATA: path.join(temporaryRoot, "local-app-data"),
    FRICTION_HOME: privateHome,
    PATH: `${binaryDirectory}${path.delimiter}${process.env.PATH ?? ""}`,
  });
  const runInstalled = (arguments_, options = {}) => {
    if (process.platform !== "win32") {
      return run(binary, arguments_, { ...options, env: environment });
    }

    assert.equal(arguments_.every((value) => /^[a-zA-Z0-9._-]+$/.test(value)), true);
    const command = ["friction", ...arguments_].join(" ");
    return run(process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe", ["/d", "/s", "/c", command], {
      ...options,
      env: environment,
    });
  };
  const expectedBodies = [
    "Packaged capture: blåbær, 漢字, emoji 🧭, and an arrow →.",
  ];

  if (process.platform === "win32") {
    const utf8PowerShell = [
      "$utf8NoBom = [System.Text.UTF8Encoding]::new($false)",
      "$OutputEncoding = $utf8NoBom",
      "[Console]::OutputEncoding = $utf8NoBom",
      "$env:FRICTION_TEST_BODY | friction add --stdin --source codex --json",
    ].join("; ");
    const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
    const powershell = path.join(
      systemRoot,
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
    const shellCases = [
      ["pwsh.exe", "PowerShell 7 capture: blåbær, 漢字, emoji 🧭, arrow →."],
      [powershell, "PowerShell 5.1 capture: blåbær, 漢字, emoji 🧭, arrow →."],
    ];

    for (const [executable, shellBody] of shellCases) {
      const captured = await run(
        executable,
        ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", utf8PowerShell],
        {
          cwd: workingDirectory,
          env: childEnvironment({
            ...environment,
            FRICTION_TEST_BODY: shellBody,
          }),
        },
      );
      assert.equal(captured.stdout.includes(shellBody), false);
      assert.equal(JSON.parse(captured.stdout).ok, true);
      expectedBodies.push(shellBody);
    }

    const gitBash = path.join(
      process.env.ProgramFiles ?? "C:\\Program Files",
      "Git",
      "bin",
      "bash.exe",
    );
    const gitBashBody = "Git Bash capture: blåbær, 漢字, emoji 🧭, arrow →.";
    const captured = await run(
      gitBash,
      [
        "--noprofile",
        "--norc",
        "-c",
        "printf '%s\\n' \"$FRICTION_TEST_BODY\" | friction add --stdin --source claude-code --json",
      ],
      {
        cwd: workingDirectory,
        env: childEnvironment({
          ...environment,
          FRICTION_TEST_BODY: gitBashBody,
        }),
      },
    );
    assert.equal(captured.stdout.includes(gitBashBody), false);
    assert.equal(JSON.parse(captured.stdout).ok, true);
    expectedBodies.push(gitBashBody);
  }
  const version = await runInstalled(["--version"], { cwd: workingDirectory });
  assert.equal(version.stdout.trim(), packageVersion);
  const help = await runInstalled(["--help"], { cwd: workingDirectory });
  assert.match(help.stdout, /add\s+Record one screened observation/);
  const setupHelp = await runInstalled(["setup", "--help"], { cwd: workingDirectory });
  assert.match(setupHelp.stdout, /--apply/);
  assert.match(setupHelp.stdout, /[Pp]review/);
  const schemaEnvelope = JSON.parse(
    (await runInstalled(["schema"], { cwd: workingDirectory })).stdout,
  );
  const schema = schemaEnvelope.data;
  assert.equal(schema.commands.publish.effects.writesRepository, true);
  assert.equal(schema.commands.setup.effects.previewDefault, true);
  assert.equal(schema.events.reopened.fields.includes("verification"), false);
  assert.equal(schema.environment.includes("CODEX_HOME"), true);
  assert.equal(schema.byteLimits.body, 4_096);
  assert.equal(schema.errors.io_error.message, "An I/O operation failed.");
  assert.equal(schema.errors.io_error.retryable, false);
  assert.equal(schema.platforms.win32.privateStore, "%LOCALAPPDATA%\\friction");
  assert.equal(schema.platforms.win32.requiresAclVerification, true);
  assert.equal(schema.windows.pathRestrictions.reparsePoints, false);
  assert.equal(schema.setupAdapters.codex.win32, "powershell");
  assert.equal(schema.setupAdapters.claudeCode.win32, "git-bash");
  assert.equal(schema.environment.includes("PATHEXT"), true);
  const body = expectedBodies[0];
  const added = await runInstalled(
    ["add", "--stdin", "--source", "generic", "--json"],
    { cwd: workingDirectory, input: `${body}\n` },
  );
  assert.equal(added.stdout.includes(body), false);
  assert.equal(JSON.parse(added.stdout).ok, true);
  const listed = await runInstalled(["list", "--status", "all", "--json"], {
    cwd: workingDirectory,
  });
  const listEnvelope = JSON.parse(listed.stdout);
  assert.equal(listEnvelope.ok, true);
  assert.equal(listEnvelope.data.count, expectedBodies.length);
  assert.deepEqual(
    new Set(listEnvelope.data.records.map((record) => record.body)),
    new Set(expectedBodies),
  );
  const doctor = JSON.parse(
    (await runInstalled(["doctor", "--json"], { cwd: workingDirectory })).stdout,
  );
  assert.equal(doctor.ok, true);
  console.log("Package smoke passed: assets, command shim, Unicode capture, list, and doctor.");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
