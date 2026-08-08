import assert from "node:assert/strict";
import test from "node:test";

import { FrictionFailure } from "../../src/domain/failures.js";
import {
  buildChildEnvironment,
  getEnvironmentValue,
} from "../../src/platform/environment.js";
import { assertSafeWindowsAbsolutePath } from "../../src/platform/windows/path-policy.js";
import { resolveFrictionPaths } from "../../src/storage/paths.js";

function failureCode(error: unknown, code: string): boolean {
  return error instanceof FrictionFailure && error.code === code;
}

test("platform contracts resolve and reject Windows private homes without writes", () => {
  const defaults = resolveFrictionPaths({
    platform: "win32",
    environment: {
      LocalAppData: "C:\\Users\\Example\\AppData\\Local",
    },
  });
  assert.deepEqual(defaults, {
    home: "C:\\Users\\Example\\AppData\\Local\\friction",
    events: "C:\\Users\\Example\\AppData\\Local\\friction\\v1\\events",
    temporary: "C:\\Users\\Example\\AppData\\Local\\friction\\v1\\tmp",
    setupLocks: "C:\\Users\\Example\\AppData\\Local\\friction\\v1\\setup-locks",
  });

  const override = resolveFrictionPaths({
    platform: "win32",
    environment: {
      friction_home: "D:\\Private\\FrictionData",
      LOCALAPPDATA: "C:\\Ignored",
    },
  });
  assert.equal(override.home, "D:\\Private\\FrictionData");
  assert.equal(
    assertSafeWindowsAbsolutePath("\\\\server\\share\\repo\\projection.jsonl"),
    "\\\\server\\share\\repo\\projection.jsonl",
  );

  assert.throws(
    () => resolveFrictionPaths({ platform: "win32", environment: {} }),
    (error) => failureCode(error, "configuration_error"),
  );

  for (const invalid of [
    "C:relative",
    "\\\\server\\share\\friction",
    "\\\\?\\C:\\friction",
    "\\\\.\\C:\\friction",
    "\\??\\C:\\friction",
    "C:\\safe\\CON.txt",
    "C:\\safe\\event:stream",
    "C:\\safe\\trailing.",
  ]) {
    assert.throws(
      () =>
        resolveFrictionPaths({
          platform: "win32",
          environment: { FRICTION_HOME: invalid },
        }),
      (error) => failureCode(error, "invalid_input"),
      invalid,
    );
  }

  const child = buildChildEnvironment(
    { PATH: "C:\\Tools", TEMP: "C:\\Temp" },
    { Path: "C:\\Windows", PATH: "C:\\Duplicate", SystemRoot: "C:\\Windows" },
    "win32",
  );
  assert.equal(
    Object.keys(child).filter((key) => key.toLowerCase() === "path").length,
    1,
  );
  assert.equal(getEnvironmentValue("path", child, "win32"), "C:\\Tools");
  assert.equal(getEnvironmentValue("PATH", { Path: "lower" }, "linux"), undefined);
});
