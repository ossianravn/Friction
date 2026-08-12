import { areas, eventTypes, impacts } from "../domain/events.js";
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
import {
  builtInSources,
  SOURCE_IDENTIFIER_MAX_BYTES,
  SOURCE_IDENTIFIER_PATTERN,
} from "../domain/source.js";
import { integrationCatalog } from "../integrations/catalog.js";
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

function commands() {
  return Object.fromEntries(
    commandNames.map((name) => [
      name,
      {
        purpose: commandContract[name].purpose,
        syntax: commandContract[name].syntax,
        flags: [
          ...commandContract[name].options.map(
            (option) => option.name.split(" ")[0],
          ),
          "--json",
        ],
        notes: commandContract[name].notes,
        effects: commandContract[name].effects,
      },
    ]),
  );
}

export function currentSchema(): object {
  return {
    contractVersion: 2,
    cliVersion: CLI_VERSION,
    commands: commands(),
    commonFlags: ["--help", "--version", "--json"],
    platforms: {
      darwin: { supported: true },
      linux: { supported: true },
      win32: {
        supported: true,
        releaseStatus: "under-validation",
        privateStore: "%LOCALAPPDATA%\\friction",
        requiresAclVerification: true,
        privateUncStore: false,
      },
    },
    windows: {
      privateAcl: {
        principals: ["current-user", "LocalSystem"],
        inheritanceProtected: true,
        verificationRequiredBeforePersistence: true,
      },
      pathRestrictions: {
        fullyQualifiedLocal: true,
        driveRelative: false,
        deviceNamespace: false,
        alternateDataStreams: false,
        reservedNames: false,
        trailingDotOrSpace: false,
        reparsePoints: false,
      },
      requiredFilesystemCapabilities: [
        "exclusive-create",
        "hard-link-install",
        "replace-existing",
        "lock-file",
      ],
    },
    integrations: integrationCatalog,
    sourceIdentifiers: {
      pattern: SOURCE_IDENTIFIER_PATTERN,
      maximumUtf8Bytes: SOURCE_IDENTIFIER_MAX_BYTES,
      builtInExamples: builtInSources,
      informationalOnly: true,
    },
    enums: { areas, impacts },
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
      omittedPrivateFields: [
        "repository.key",
        "repository.head",
        "lastLifecycleEvent",
      ],
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
    environment: [
      "FRICTION_HOME",
      "XDG_DATA_HOME",
      "HOME",
      "USERPROFILE",
      "LOCALAPPDATA",
      "CODEX_HOME",
      "HERMES_HOME",
      "PATH",
      "PATHEXT",
      "SystemRoot",
      "ComSpec",
    ],
    notes: [
      "Standard repository setup uses AGENTS.md and Agent Skills.",
      "Remote environments require their own CLI installation and setup.",
    ],
  };
}
