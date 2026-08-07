import {
  failureCodes,
  type FailureCode,
} from "../domain/failures.js";

export type ErrorDefinition = {
  message: string;
  exitCode: number;
  retryable: boolean;
};

export const errorRegistry: Record<FailureCode, ErrorDefinition> = {
  internal_error: {
    message: "An internal error occurred.",
    exitCode: 1,
    retryable: false,
  },
  io_error: {
    message: "The private event could not be stored.",
    exitCode: 1,
    retryable: true,
  },
  invalid_input: {
    message: "Invalid input.",
    exitCode: 2,
    retryable: false,
  },
  not_found: {
    message: "The requested observation or repository was not found.",
    exitCode: 3,
    retryable: false,
  },
  setup_conflict: {
    message: "Setup target changed before apply.",
    exitCode: 4,
    retryable: false,
  },
  output_conflict: {
    message: "Output target cannot be replaced safely.",
    exitCode: 4,
    retryable: false,
  },
  publish_conflict: {
    message: "Publish target changed before apply.",
    exitCode: 4,
    retryable: false,
  },
  safety_failure: {
    message: "Safety screening failed; nothing was stored.",
    exitCode: 6,
    retryable: false,
  },
  unsupported_platform: {
    message: "This platform is not supported.",
    exitCode: 6,
    retryable: false,
  },
  corrupt_store: {
    message: "The private event store is not healthy.",
    exitCode: 1,
    retryable: false,
  },
};

export function errorDictionary(): Record<string, ErrorDefinition> {
  return Object.fromEntries(
    failureCodes.map((code) => [code, errorRegistry[code]]),
  );
}
