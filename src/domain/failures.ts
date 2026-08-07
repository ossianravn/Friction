export const failureCodes = [
  "internal_error",
  "io_error",
  "invalid_input",
  "not_found",
  "setup_conflict",
  "output_conflict",
  "publish_conflict",
  "safety_failure",
  "unsupported_platform",
  "corrupt_store",
] as const;

export type FailureCode = (typeof failureCodes)[number];

export class FrictionFailure extends Error {
  override readonly name = "FrictionFailure";

  constructor(readonly code: FailureCode) {
    super(code);
  }
}
