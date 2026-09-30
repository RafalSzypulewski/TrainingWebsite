import { test, expect } from './fixtures';
import { crawl, findBroken } from './crawler';

/**
 * Crawls the site in a real browser (so links and images created by JavaScript count too),
 * then requests every internal URL it found and expects a 200. See crawler.ts for the details.
 * Running it against the deployed site catches files that exist in the repo but were never published.
 */
test('every internal link, image, script, stylesheet and frame resolves', async ({ page, baseURL }) => {
  test.setTimeout(180_000);
  const { visited, found } = await crawl(page, baseURL!);

  // Guard against a vacuous pass if the crawl somehow found (almost) nothing.
  expect(visited.size, 'pages visited').toBeGreaterThanOrEqual(20);
  expect(found.size, 'distinct URLs checked').toBeGreaterThanOrEqual(40);

  expect(await findBroken(page, found), 'broken internal references').toEqual([]);
});
