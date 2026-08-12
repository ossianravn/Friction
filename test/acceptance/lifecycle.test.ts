import assert from "node:assert/strict";
import test from "node:test";

import {
  addObservation,
  envelope,
  eventNames,
  makeAcceptanceFixture,
} from "../support/acceptance.js";
import { runFriction } from "../support/process.js";

test("resolve and reopen append deterministic lifecycle state and remain idempotent", async () => {
  const context = await makeAcceptanceFixture("friction-lifecycle-");
  const repeatedBody = "A wrapper hid its working directory and caused a retry.";
  const firstId = await addObservation(context.home, context.work, repeatedBody);
  await addObservation(context.home, context.work, repeatedBody);

  const stats = envelope(
    await runFriction({
      arguments: ["stats", "--status", "all", "--json"],
      cwd: context.work,
      home: context.home,
    }),
  ).data;
  assert.equal(stats["total"], 2);
  assert.deepEqual(stats["byStatus"], { open: 2 });
  assert.deepEqual(stats["exactRepeats"], [{ body: repeatedBody, count: 2 }]);

  const credentialSource = `sk-${"b".repeat(20)}`;
  const unsafeSource = await runFriction({
    arguments: ["resolve", firstId, "--source", credentialSource, "--json"],
    cwd: context.work,
    home: context.home,
  });
  assert.equal(unsafeSource.code, 2);
  assert.equal(unsafeSource.stdout.includes(credentialSource), false);
  assert.equal((await eventNames(context.home)).length, 2);

  const resolved = envelope(
    await runFriction({
      arguments: [
        "resolve",
        firstId,
        "--note",
        "api_token=lifecycle-note-canary",
        "--verification",
        "MY_API_KEY=lifecycle-verification-canary",
        "--source",
        "review-agent",
        "--json",
      ],
      cwd: context.work,
      home: context.home,
    }),
  ).data;
  assert.equal(resolved["changed"], true);
  assert.equal(resolved["status"], "resolved");
  assert.equal((await eventNames(context.home)).length, 3);

  const resolvedViews = await runFriction({
    arguments: ["list", "--status", "all", "--json"],
    cwd: context.work,
    home: context.home,
  });
  assert.equal(resolvedViews.stdout.includes("lifecycle-note-canary"), false);
  assert.equal(resolvedViews.stdout.includes("lifecycle-verification-canary"), false);
  const resolvedRecords = envelope(resolvedViews).data["records"] as Array<Record<string, unknown>>;
  assert.equal(
    resolvedRecords.find((record) => record["observationId"] === firstId)?.["redactionCount"],
    2,
  );
  const resolvedStats = envelope(
    await runFriction({
      arguments: ["stats", "--status", "all", "--json"],
      cwd: context.work,
      home: context.home,
    }),
  ).data;
  assert.equal(resolvedStats["redactedRecordCount"], 1);
  assert.equal(resolvedStats["replacementCount"], 2);

  const resolvedAgain = envelope(
    await runFriction({
      arguments: ["resolve", firstId, "--json"],
      cwd: context.work,
      home: context.home,
    }),
  ).data;
  assert.equal(resolvedAgain["changed"], false);
  assert.equal(resolvedAgain["lifecycleEventId"], null);
  assert.equal((await eventNames(context.home)).length, 3);

  const openList = envelope(
    await runFriction({
      arguments: ["list", "--json"],
      cwd: context.work,
      home: context.home,
    }),
  ).data;
  assert.equal(openList["count"], 1);

  const reopened = envelope(
    await runFriction({
      arguments: ["reopen", firstId, "--note", "The behavior recurred.", "--json"],
      cwd: context.work,
      home: context.home,
    }),
  ).data;
  assert.equal(reopened["changed"], true);
  assert.equal(reopened["status"], "open");
  assert.equal((await eventNames(context.home)).length, 4);

  const reopenedAgain = envelope(
    await runFriction({
      arguments: ["reopen", firstId, "--json"],
      cwd: context.work,
      home: context.home,
    }),
  ).data;
  assert.equal(reopenedAgain["changed"], false);
  assert.equal((await eventNames(context.home)).length, 4);
});
