import type { User } from '@firebase/auth';
import { reload } from '@firebase/auth';

import { apiFetch, ApiError } from '../api';
import { getIdToken } from '../firebase';
import { completeProfile, hasProfile, PROFILE_FIELDS_REQUIRED, profileBody } from '../profile';

jest.mock('@firebase/auth', () => ({ reload: jest.fn(), sendEmailVerification: jest.fn() }));
jest.mock('../firebase', () => ({ getIdToken: jest.fn() }));
jest.mock('../api', () => {
  const actual = jest.requireActual('../api');
  return { ...actual, apiFetch: jest.fn() };
});

const fields = { displayName: '  Amina B. ', firstName: ' Amina ', city: '  ' };

afterEach(() => jest.clearAllMocks());

describe('profileBody', () => {
  it('trims the fields and sends no empty city', () => {
    expect(profileBody(fields)).toEqual({ displayName: 'Amina B.', firstName: 'Amina', city: null });
  });

  it('refuses an empty display name', () => {
    expect(profileBody({ ...fields, displayName: '   ' })).toBeNull();
  });

  it('requires a display name between 2 and 60 characters', () => {
    expect(profileBody({ ...fields, displayName: 'A' })).toBeNull();
    expect(profileBody({ ...fields, displayName: 'A'.repeat(61) })).toBeNull();
    expect(profileBody({ ...fields, displayName: 'AB' })?.displayName).toBe('AB');
    expect(profileBody({ ...fields, displayName: 'A'.repeat(60) })?.displayName).toHaveLength(60);
  });
});

describe('hasProfile', () => {
  it('returns true when the account has a profile', async () => {
    (getIdToken as jest.Mock).mockResolvedValue('profile-token');
    (apiFetch as jest.Mock).mockResolvedValueOnce({ id: 'profile-id' });

    await expect(hasProfile()).resolves.toBe(true);
    expect(apiFetch).toHaveBeenCalledWith('/users/me', { token: 'profile-token' });
  });

  it('returns false only when the API confirms the profile is missing', async () => {
    (getIdToken as jest.Mock).mockResolvedValue(null);
    (apiFetch as jest.Mock).mockRejectedValueOnce(new ApiError(404, 'PROFILE_NOT_FOUND', 'missing'));

    await expect(hasProfile()).resolves.toBe(false);
    expect(apiFetch).toHaveBeenCalledWith('/users/me', { token: undefined });
  });

  it('lets other failures fall through to the app', async () => {
    (apiFetch as jest.Mock).mockRejectedValueOnce(new Error('network failure'));

    await expect(hasProfile()).resolves.toBe(true);
  });
});

describe('completeProfile', () => {
  it('reloads the account, then creates the profile with a fresh token once the email is verified', async () => {
    const user = { emailVerified: false } as User;
    (reload as jest.Mock).mockImplementation(async () => { (user as { emailVerified: boolean }).emailVerified = true; });
    (getIdToken as jest.Mock).mockResolvedValue('fresh-token');

    await completeProfile(user, fields);

    expect(reload).toHaveBeenCalledWith(user);
    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(apiFetch).toHaveBeenCalledWith('/users', {
      method: 'POST',
      token: 'fresh-token',
      body: { displayName: 'Amina B.', firstName: 'Amina', city: null },
    });
  });

  it('stops before the API while the email is still unverified', async () => {
    const user = { emailVerified: false } as User;
    await expect(completeProfile(user, fields)).rejects.toMatchObject({ code: 'IDENTITY_EMAIL_UNVERIFIED' });
    await expect(completeProfile(user, fields)).rejects.toBeInstanceOf(ApiError);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('asks for a display name without touching Firebase or the API', async () => {
    await expect(completeProfile({ emailVerified: true } as User, { ...fields, displayName: '' })).rejects.toThrow(PROFILE_FIELDS_REQUIRED);
    expect(reload).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
