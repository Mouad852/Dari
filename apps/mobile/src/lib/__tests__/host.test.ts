import { memberSinceLabel, verificationLabel } from '../host';

describe('host card labels', () => {
  it('names each verification tier as the web does', () => {
    expect(verificationLabel('NONE')).toBe('Non vérifié');
    expect(verificationLabel('EMAIL')).toBe('Email vérifié');
    expect(verificationLabel('EMAIL_PHONE')).toBe('Email et téléphone vérifiés');
  });

  it('states the month and year the member joined', () => {
    expect(memberSinceLabel({ memberSince: '2026-09-15T10:00:00Z' })).toBe('Membre depuis septembre 2026');
  });
});
