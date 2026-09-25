import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';

/**
 * The open thread: it starts at the newest message, loads older ones on
 * request, and picks up a reply written while it is open through its 5 s poll
 * (`after=` the newest message it has fetched).
 */
const MOCK = 'http://127.0.0.1:4110';

type Call = { method: string; path: string; query?: string; status: number };

async function afterPolls(page: Page): Promise<number> {
  const response = await page.request.get(`${MOCK}/__calls`);
  const calls = (await response.json()) as Call[];
  return calls.filter((call) => call.method === 'GET'
    && call.path === '/conversations/conversation-1/messages'
    && (call.query ?? '').includes('after=')).length;
}

test('a reply written while the thread is open appears within one poll, exactly once', async ({ authenticatedPage: page, request }) => {
  await page.goto('/messages/conversation-1');
  const log = page.getByRole('log', { name: 'Messages de la conversation' });
  await expect(log.getByRole('listitem')).toHaveCount(1);

  await request.post(`${MOCK}/__messages`, { data: { body: 'Oui, elle est toujours libre.' } });
  // One poll interval is 5 s; allow for the request itself.
  await expect(log.getByText('Oui, elle est toujours libre.')).toHaveCount(1, { timeout: 7_000 });
  await expect(log.getByRole('listitem')).toHaveCount(2);

  // A further poll finds nothing new and adds nothing.
  const seen = await afterPolls(page);
  await expect.poll(() => afterPolls(page), { timeout: 12_000 }).toBeGreaterThan(seen);
  await expect(log.getByText('Oui, elle est toujours libre.')).toHaveCount(1);
  await expect(log.getByRole('listitem')).toHaveCount(2);
});

test('a message committed after a newer one was already polled still appears, in send order and once', async ({ authenticatedPage: page, request }) => {
  await page.goto('/messages/conversation-1');
  const log = page.getByRole('log', { name: 'Messages de la conversation' });
  await expect(log.getByRole('listitem')).toHaveCount(1);

  await request.post(`${MOCK}/__messages`, { data: { body: 'Réponse déjà reçue.' } });
  await expect(log.getByText('Réponse déjà reçue.')).toHaveCount(1, { timeout: 7_000 });

  // Stamped before that reply, visible only now: after= the reply would skip it.
  await request.post(`${MOCK}/__late-message`, { data: { body: 'Message validé en retard.' } });
  await expect(log.getByText('Message validé en retard.')).toHaveCount(1, { timeout: 7_000 });
  await expect(log.getByRole('listitem')).toHaveCount(3);
  await expect(log.getByRole('listitem').nth(1)).toContainText('Message validé en retard.');

  // Later polls read the overlap again and still add nothing.
  const seen = await afterPolls(page);
  await expect.poll(() => afterPolls(page), { timeout: 12_000 }).toBeGreaterThan(seen);
  await expect(log.getByRole('listitem')).toHaveCount(3);
  await expect(log.getByText('Réponse déjà reçue.')).toHaveCount(1);
});

test('a reply arriving while the reader is further up leaves them where they are', async ({ authenticatedPage: page, request }) => {
  await request.post(`${MOCK}/__thread`, { data: { count: 20 } });
  await page.goto('/messages/conversation-1');
  const log = page.getByRole('log', { name: 'Messages de la conversation' });
  await expect(log.getByRole('listitem')).toHaveCount(20);

  // The message region is the log's nearest scrolling ancestor.
  const scrollTop = () => log.evaluate((element) => {
    let node = element.parentElement;
    while (node && getComputedStyle(node).overflowY !== 'auto') node = node.parentElement;
    return node ? node.scrollTop : -1;
  });
  await log.evaluate((element) => {
    let node = element.parentElement;
    while (node && getComputedStyle(node).overflowY !== 'auto') node = node.parentElement;
    if (node) node.scrollTop = 0;
  });
  await expect.poll(scrollTop).toBe(0);

  await request.post(`${MOCK}/__messages`, { data: { body: 'Une réponse plus bas.' } });
  await expect(log.getByText('Une réponse plus bas.')).toHaveCount(1, { timeout: 7_000 });
  expect(await scrollTop()).toBe(0);
});

test('a long thread opens at its newest message and loads older ones above without moving the reader', async ({ authenticatedPage: page, request }) => {
  await request.post(`${MOCK}/__thread`, { data: { count: 45 } });
  await page.goto('/messages/conversation-1');
  const log = page.getByRole('log', { name: 'Messages de la conversation' });
  // An item's text runs the body into its time ("Message 4511:46"), so the
  // number is the one directly followed by HH:MM.
  const thread = page.getByRole('main').getByRole('listitem');
  const bubble = (n: number) => thread.filter({ hasText: new RegExp(`Message ${n}(?=\\d{2}:\\d{2})`) });

  await expect(log.getByRole('listitem')).toHaveCount(20);
  await expect(bubble(45)).toBeInViewport();
  await expect(bubble(26)).toHaveCount(1);
  await expect(bubble(25)).toHaveCount(0);

  await page.getByRole('button', { name: 'Voir les messages précédents' }).click();
  await expect(thread).toHaveCount(40);
  // The message that was at the top before the load is still on screen.
  await expect(bubble(26)).toBeInViewport();
  // Older pages sit outside the live region, so they are not read out.
  await expect(log.getByRole('listitem')).toHaveCount(20);

  await page.getByRole('button', { name: 'Voir les messages précédents' }).click();
  await expect(thread).toHaveCount(45);
  await expect(log.getByRole('listitem')).toHaveCount(20);
  await expect(bubble(1)).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Voir les messages précédents' })).toHaveCount(0);
});
