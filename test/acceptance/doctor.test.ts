import assert from "node:assert/strict";
import { stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  addObservation,
  envelope,
  makeAcceptanceFixture,
} from "../support/acceptance.js";
import { runFriction } from "../support/process.js";

test("missing storage is empty and doctor reports corrupt files without body content", async () => {
  const context = await makeAcceptanceFixture("friction-doctor-");
  const empty = envelope(
    await runFriction({
      arguments: ["list", "--json"],
      cwd: context.work,
      home: context.home,
    }),
  );
  assert.equal(empty.data["count"], 0);
  await assert.rejects(stat(context.home));

  await addObservation(context.home, context.work, "api_token=doctor-screened-canary");
  const corruptCanary = "doctor-corrupt-canary";
  await writeFile(
    path.join(context.home, "v1", "events", "corrupt.json"),
    `{"body":"${corruptCanary}"`,
    { encoding: "utf8", mode: 0o600 },
  );
  const overlongCanary = "doctor-overlong-canary";
  const overlongEventId = `evt_${"a".repeat(32)}`;
  await writeFile(
    path.join(context.home, "v1", "events", `${overlongEventId}.json`),
    `${JSON.stringify({
      schemaVersion: 1,
      eventType: "observation",
      eventId: overlongEventId,
      observationId: `fr_${"b".repeat(32)}`,
      createdAt: "2026-08-07T12:00:00.000Z",
      body: overlongCanary.padEnd(4_097, "x"),
      source: "manual",
      model: null,
      area: null,
      impacts: [],
      repository: null,
      redaction: { rulesetVersion: 1, replacementCount: 0 },
      clientVersion: "test",
    })}\n`,
    { encoding: "utf8", mode: 0o600 },
  );

  const list = await runFriction({
    arguments: ["list", "--status", "all", "--json"],
    cwd: context.work,
    home: context.home,
  });
  assert.equal(list.code, 0);
  assert.equal(list.stdout.includes(corruptCanary), false);
  assert.equal(list.stdout.includes(overlongCanary), false);
  assert.equal(envelope(list).warnings[0]?.["code"], "event_findings");

  const doctor = await runFriction({
    arguments: ["doctor", "--json"],
    cwd: context.work,
    home: context.home,
  });
  assert.equal(doctor.code, 1);
  assert.equal(doctor.stderr, "");
  assert.equal(doctor.stdout.includes(corruptCanary), false);
  assert.equal(doctor.stdout.includes(overlongCanary), false);
  const checks = envelope(doctor).data["checks"] as Array<Record<string, unknown>>;
  assert.equal(
    checks.some(
      (check) => check["name"] === "event-health" && check["status"] === "error",
    ),
    true,
  );
  assert.equal(
    checks.some(
      (check) =>
        check["name"] === "event-health" &&
        (check["message"] as string).includes("invalid-event"),
    ),
    true,
  );
  assert.equal(
    checks.some(
      (check) =>
        check["name"] === "event-count" &&
        (check["message"] as string).startsWith("1 valid event"),
    ),
    true,
  );
});
