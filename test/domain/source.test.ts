import assert from "node:assert/strict";
import test from "node:test";

import {
  SOURCE_IDENTIFIER_MAX_BYTES,
  isSource,
} from "../../src/domain/source.js";

test("source identifiers are open but bounded by the stable machine contract", () => {
  assert.equal(isSource("my-agent-2"), true);
  assert.equal(isSource("a".repeat(SOURCE_IDENTIFIER_MAX_BYTES)), true);
  assert.equal(isSource(""), false);
  assert.equal(isSource("Codex"), false);
  assert.equal(isSource("two--hyphens"), false);
  assert.equal(isSource("a".repeat(SOURCE_IDENTIFIER_MAX_BYTES + 1)), false);
  assert.equal(isSource("agent_underscore"), false);
  assert.equal(isSource(`sk-${"a".repeat(20)}`), false);
});
