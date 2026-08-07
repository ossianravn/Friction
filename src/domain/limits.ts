export const BODY_MAX_BYTES = 4_096;
export const MODEL_MAX_BYTES = 128;
export const REPOSITORY_NAME_MAX_BYTES = 255;
export const BRANCH_MAX_BYTES = 512;
export const CWD_RELATIVE_MAX_BYTES = 2_048;
export const LIFECYCLE_NOTE_MAX_BYTES = 2_048;
export const LIFECYCLE_VERIFICATION_MAX_BYTES = 512;
export const REPOSITORY_IDENTITY_MAX_BYTES = 4_096;

export function fitsUtf8(value: string, maximumBytes: number): boolean {
  return Buffer.byteLength(value, "utf8") <= maximumBytes;
}
