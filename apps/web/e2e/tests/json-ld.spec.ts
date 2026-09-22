import { expect, test } from './fixtures';

test('owner text cannot close the listing JSON-LD script element', async ({ request }) => {
  // Check the server HTML, not the DOM: after hydration React rewrites the
  // element and the CSP hides an injected script, which would mask the defect.
  const html = await (await request.get('/listings/listing-1')).text();

  // An HTML parser ends a script element at the first "</script>", whatever
  // JSON it is inside. Unescaped owner text therefore truncates this block.
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  expect(block).toBeDefined();
  const structuredData = JSON.parse(block!);
  expect(structuredData.description).toContain('</script><script>window.__jsonLdBreakout = true</script>');
  expect(html).not.toContain('<script>window.__jsonLdBreakout');
});
