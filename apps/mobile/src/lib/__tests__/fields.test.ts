import { ApiError } from '../api';
import { fieldErrors, MAX_LENGTH } from '../fields';

// api.ts pulls in Firebase (and its native AsyncStorage) and the router; none of it runs here.
jest.mock('../config', () => ({ API_BASE_URL: 'https://api.example.invalid/api/v1' }));
jest.mock('../firebase', () => ({ getIdToken: jest.fn(), signOut: jest.fn(async () => undefined) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('fieldErrors', () => {
  it('returns the per-field messages of a validation failure', () => {
    const error = new ApiError(400, 'VALIDATION_FAILED', 'Données invalides', { bio: '600 caractères maximum' });
    expect(fieldErrors(error)).toEqual({ bio: '600 caractères maximum' });
  });

  it('is empty for an API error without fields and for any other failure', () => {
    expect(fieldErrors(new ApiError(409, 'ILLEGAL_TRANSITION', 'Transition illégale'))).toEqual({});
    expect(fieldErrors(new Error('network'))).toEqual({});
    expect(fieldErrors(undefined)).toEqual({});
  });
});

describe('MAX_LENGTH', () => {
  it('lets the sign-up names fill, but never exceed, the 60-character display name', () => {
    expect(MAX_LENGTH.signUpFirstName + 1 + MAX_LENGTH.signUpLastName).toBe(MAX_LENGTH.displayName);
  });
});
