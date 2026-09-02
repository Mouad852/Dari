/**
 * Mirrors ma.dari.api.common.error.ErrorCode.
 *
 * Kept as a hand-written union rather than generated, because it is small and
 * changes rarely. If it grows past this size, generate it from the server enum
 * instead of letting the two drift.
 */
export const ErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  ACCOUNT_BANNED: 'ACCOUNT_BANNED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  PROFILE_ALREADY_EXISTS: 'PROFILE_ALREADY_EXISTS',
  FORBIDDEN: 'FORBIDDEN',
  NOT_OWNER: 'NOT_OWNER',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_CURSOR: 'INVALID_CURSOR',
  ILLEGAL_TRANSITION: 'ILLEGAL_TRANSITION',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
