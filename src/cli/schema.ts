import { areas, impacts, sources } from "../domain/events.js";
import { BODY_MAX_BYTES, MODEL_MAX_BYTES } from "../capture/input.js";
import { CLI_VERSION } from "../version.js";
import { errorDictionary } from "./errors.js";

export function currentSchema(): object {
  return {
    contractVersion: 1,
    cliVersion: CLI_VERSION,
    commands: {
      add: {
        mutation: "appending",
        syntax: ["friction add TEXT", "friction add --stdin"],
        flags: ["--stdin", "--source", "--model", "--area", "--impact", "--json"],
      },
      list: {
        mutation: "read-only",
        syntax: ["friction list"],
        flags: ["--repo", "--since", "--limit", "--status", "--json"],
      },
      stats: {
        mutation: "read-only",
        syntax: ["friction stats"],
        flags: ["--repo", "--since", "--status", "--json"],
      },
      resolve: {
        mutation: "appending",
        syntax: ["friction resolve ID"],
        flags: ["--note", "--verification", "--source", "--json"],
      },
      reopen: {
        mutation: "appending",
        syntax: ["friction reopen ID"],
        flags: ["--note", "--source", "--json"],
      },
      export: {
        mutation: "read-only-or-file-writing",
        syntax: ["friction export"],
        flags: ["--repo", "--since", "--status", "--format", "--output", "--force", "--json"],
      },
      publish: {
        mutation: "preview-or-repository-writing",
        syntax: ["friction publish ID [ID ...]", "friction publish --all-open"],
        flags: ["--all-open", "--output", "--apply", "--json"],
      },
      purge: {
        mutation: "destructive-with-apply",
        syntax: ["friction purge ID"],
        flags: ["--apply", "--json"],
      },
      doctor: {
        mutation: "read-mostly",
        syntax: ["friction doctor"],
        flags: ["--json"],
      },
      setup: {
        mutation: "preview-or-configuration-writing",
        syntax: ["friction setup codex|claude-code|generic"],
        flags: ["--scope", "--apply", "--undo", "--json"],
      },
      schema: {
        mutation: "read-only",
        syntax: ["friction schema"],
        flags: ["--json"],
      },
    },
    commonFlags: ["--help", "--version", "--json"],
    enums: { sources, areas, impacts },
    byteLimits: {
      body: BODY_MAX_BYTES,
      model: MODEL_MAX_BYTES,
      lifecycleNote: 2_048,
      lifecycleVerification: 512,
      repositoryName: 255,
      branch: 512,
      cwdRelative: 2_048,
      remotePreimage: 4_096,
    },
    event: {
      schemaVersion: 1,
      eventTypes: ["observation", "resolved", "reopened"],
      observationFields: [
        "schemaVersion",
        "eventType",
        "eventId",
        "observationId",
        "createdAt",
        "body",
        "source",
        "model",
        "area",
        "impacts",
        "repository",
        "redaction",
        "clientVersion",
      ],
      lifecycleFields: [
        "schemaVersion",
        "eventType",
        "eventId",
        "observationId",
        "createdAt",
        "actor",
        "note",
        "verification",
        "redaction",
        "clientVersion",
      ],
    },
    materializedRecord: {
      fields: [
        "observation",
        "status",
        "resolution",
        "lastLifecycleEvent",
      ],
      statuses: ["open", "resolved"],
    },
    publishedObservation: {
      schemaVersion: 1,
      format: "compact-jsonl",
      fields: [
        "schemaVersion",
        "observationId",
        "createdAt",
        "status",
        "body",
        "source",
        "model",
        "area",
        "impacts",
        "repository",
        "resolution",
        "redactionCount",
      ],
      canonicalStore: false,
    },
    errors: errorDictionary(),
    exitCodes: {
      success: 0,
      internalOrIo: 1,
      usageOrValidation: 2,
      notFound: 3,
      preconditionConflict: 4,
      temporaryContention: 5,
      safety: 6,
    },
    environment: ["FRICTION_HOME", "XDG_DATA_HOME", "HOME"],
  };
}
