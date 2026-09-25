import type { User } from '@firebase/auth';
import { reload } from '@firebase/auth';

import { apiFetch, ApiError } from '../api';
import { getIdToken } from '../firebase';
import { completeProfile, PROFILE_FIELDS_REQUIRED, profileBody } from '../profile';

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
