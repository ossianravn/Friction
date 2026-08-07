import { areas, eventTypes, impacts, sources } from "../domain/events.js";
import {
  BODY_MAX_BYTES,
  BRANCH_MAX_BYTES,
  CWD_RELATIVE_MAX_BYTES,
  LIFECYCLE_NOTE_MAX_BYTES,
  LIFECYCLE_VERIFICATION_MAX_BYTES,
  MODEL_MAX_BYTES,
  REPOSITORY_IDENTITY_MAX_BYTES,
  REPOSITORY_NAME_MAX_BYTES,
} from "../domain/limits.js";
import { CLI_VERSION } from "../version.js";
import { commandContract, commandNames } from "./contract.js";
import { errorDictionary } from "./errors.js";
import { exitCodes } from "./exit-codes.js";

const eventBaseFields = [
  "schemaVersion",
  "eventType",
  "eventId",
  "observationId",
  "createdAt",
] as const;

function eventFields(specific: readonly string[]): string[] {
  return [...eventBaseFields, ...specific, "redaction", "clientVersion"];
}

export function currentSchema(): object {
  return {
    contractVersion: 1,
    cliVersion: CLI_VERSION,
    commands: Object.fromEntries(
      commandNames.map((name) => [
        name,
        {
          purpose: commandContract[name].purpose,
          syntax: commandContract[name].syntax,
          flags: [
            ...commandContract[name].options.map((option) => option.name.split(" ")[0]),
            "--json",
          ],
          notes: commandContract[name].notes,
          effects: commandContract[name].effects,
        },
      ]),
    ),
    commonFlags: ["--help", "--version", "--json"],
    enums: { sources, areas, impacts },
    byteLimits: {
      body: BODY_MAX_BYTES,
      model: MODEL_MAX_BYTES,
      lifecycleNote: LIFECYCLE_NOTE_MAX_BYTES,
      lifecycleVerification: LIFECYCLE_VERIFICATION_MAX_BYTES,
      repositoryName: REPOSITORY_NAME_MAX_BYTES,
      branch: BRANCH_MAX_BYTES,
      cwdRelative: CWD_RELATIVE_MAX_BYTES,
      remotePreimage: REPOSITORY_IDENTITY_MAX_BYTES,
    },
    events: {
      schemaVersion: 1,
      eventTypes,
      observation: {
        fields: eventFields([
          "body",
          "source",
          "model",
          "area",
          "impacts",
          "repository",
        ]),
      },
      resolved: {
        fields: eventFields(["actor", "note", "verification"]),
      },
      reopened: {
        fields: eventFields(["actor", "note"]),
      },
    },
    materializedRecord: {
      visibility: "private-internal",
      fields: [
        "observation",
        "status",
        "resolution",
        "lastLifecycleEvent",
      ],
      statuses: ["open", "resolved"],
    },
    publicObservationRecord: {
      visibility: "list-and-export",
      fields: [
        "observationId",
        "createdAt",
        "body",
        "source",
        "model",
        "area",
        "impacts",
        "repository",
        "status",
        "resolution",
        "redactionCount",
      ],
      omittedPrivateFields: ["repository.key", "repository.head", "lastLifecycleEvent"],
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
      note: "This is a sanitized repository projection, not the canonical store.",
    },
    errors: errorDictionary(),
    exitCodes,
    environment: ["FRICTION_HOME", "XDG_DATA_HOME", "HOME", "CODEX_HOME", "PATH"],
  };
}
