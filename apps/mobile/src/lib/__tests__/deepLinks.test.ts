import { parseDeepLink } from '../deepLinks';

const ID = '0b5e1a7c-9f3d-4c2a-8e61-5d4f3c2b1a09';

describe('parseDeepLink', () => {
  it.each([
    [`dari://listings/${ID}`],
    [`dari:///listings/${ID}`],
    [`dari://listing/${ID}`],
    [`exp://192.168.1.20:8081/--/listings/${ID}`],
  ])('opens a listing from %s', (url) => {
    expect(parseDeepLink(url)).toEqual({ pathname: '/listing/[id]', params: { id: ID } });
  });

  it.each([
    [`dari://messages/${ID}`],
    [`dari://conversation/${ID}`],
    [`dari:///messages/${ID}`],
  ])('opens a conversation from %s', (url) => {
    expect(parseDeepLink(url)).toEqual({ pathname: '/messages/[id]', params: { id: ID } });
  });

  it('sends the web’s profile-recovery link to sign-in', () => {
    expect(parseDeepLink('dari://profile-recovery')).toEqual({ pathname: '/sign-in' });
    expect(parseDeepLink('dari:///profile-recovery')).toEqual({ pathname: '/sign-in' });
  });

  it.each([
    ['the removed account-recovery name', 'dari://account-recovery'],
    ['an unknown route', `dari://admin/${ID}`],
    ['a listing without an id', 'dari://listings'],
    ['an id that is not a plain identifier', 'dari://listings/..%2Fadmin'],
    ['extra path segments', `dari://listings/${ID}/edit`],
    ['an empty link', 'dari://'],
  ])('opens nothing for %s', (_label, url) => {
    expect(parseDeepLink(url)).toBeNull();
  });
});
