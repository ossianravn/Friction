export const exitCodes = {
  success: 0,
  internalOrIo: 1,
  usageOrValidation: 2,
  notFound: 3,
  preconditionConflict: 4,
  temporaryContention: 5,
  safety: 6,
} as const;
