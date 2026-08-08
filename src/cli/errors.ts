import {
  failureCodes,
  type FailureCode,
} from "../domain/failures.js";
import { exitCodes } from "./exit-codes.js";

export type ErrorDefinition = {
  message: string;
  exitCode: number;
  retryable: boolean;
};

export const errorRegistry: Record<FailureCode, ErrorDefinition> = {
  internal_error: {
    message: "An internal error occurred.",
    exitCode: exitCodes.internalOrIo,
    retryable: false,
  },
  io_error: {
    message: "An I/O operation failed.",
    exitCode: exitCodes.internalOrIo,
    retryable: false,
  },
  invalid_input: {
    message: "Invalid input.",
    exitCode: exitCodes.usageOrValidation,
    retryable: false,
  },
  configuration_error: {
    message: "Required platform configuration is unavailable.",
    exitCode: exitCodes.usageOrValidation,
    retryable: false,
  },
  capability_unavailable: {
    message: "Required filesystem capabilities are unavailable.",
    exitCode: exitCodes.safety,
    retryable: false,
  },
  not_found: {
    message: "The requested observation or repository was not found.",
    exitCode: exitCodes.notFound,
    retryable: false,
  },
  setup_conflict: {
    message: "Setup target changed before apply.",
    exitCode: exitCodes.preconditionConflict,
    retryable: false,
  },
  output_conflict: {
    message: "Output target cannot be replaced safely.",
    exitCode: exitCodes.preconditionConflict,
    retryable: false,
  },
  publish_conflict: {
    message: "Publish target changed before apply.",
    exitCode: exitCodes.preconditionConflict,
    retryable: false,
  },
  safety_failure: {
    message: "Safety screening failed; nothing was stored.",
    exitCode: exitCodes.safety,
    retryable: false,
  },
  indeterminate_store: {
    message: "Private-store rollback could not be confirmed.",
    exitCode: exitCodes.safety,
    retryable: false,
  },
  unsupported_platform: {
    message: "This platform is not supported.",
    exitCode: exitCodes.safety,
    retryable: false,
  },
  corrupt_store: {
    message: "The private event store is not healthy.",
    exitCode: exitCodes.internalOrIo,
    retryable: false,
  },
};

export function errorDictionary(): Record<string, ErrorDefinition> {
  return Object.fromEntries(
    failureCodes.map((code) => [code, errorRegistry[code]]),
  );
}
