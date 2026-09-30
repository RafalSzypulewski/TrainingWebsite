import type { Page } from '@playwright/test';

type Ref = { url: string; follow: boolean };

export type CrawlResult = {
  /** HTML pages that were opened in the browser. */
  visited: Set<string>;
  /** Every distinct internal URL that was referenced, with the page that first referenced it. */
  found: Map<string, string>;
};

/** Everything a page references, as absolute URLs. `follow` marks links to other pages. */
async function collectRefs(page: Page): Promise<Ref[]> {
  return page.evaluate(() => {
    const out: { url: string; follow: boolean }[] = [];
    document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => out.push({ url: a.href, follow: true }));
    document.querySelectorAll<HTMLIFrameElement>('iframe[src]').forEach((f) => out.push({ url: f.src, follow: true }));
    document.querySelectorAll<HTMLLinkElement>('link[href]').forEach((l) => out.push({ url: l.href, follow: false }));
    document.querySelectorAll<HTMLScriptElement>('script[src]').forEach((s) => out.push({ url: s.src, follow: false }));
    document.querySelectorAll<HTMLImageElement>('img[src]').forEach((i) => out.push({ url: i.src, follow: false }));
    document.querySelectorAll<HTMLSourceElement>('source[srcset]').forEach((s) => {
      // srcset may hold several "url descriptor" candidates
      s.srcset.split(',').forEach((candidate) => {
        const src = candidate.trim().split(/\s+/)[0];
        if (src) out.push({ url: new URL(src, location.href).href, follow: false });
      });
    });
    return out;
  });
}

/**
 * Pages build cards, menus and images with JavaScript after load. Instead of waiting for
 * 'networkidle' (discouraged), read the references until two consecutive reads agree.
 */
async function collectStableRefs(page: Page): Promise<Ref[]> {
  let previous = '';
  let refs: Ref[] = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    refs = await collectRefs(page);
    const snapshot = JSON.stringify(refs);
    if (snapshot === previous) return refs;
    previous = snapshot;
    await page.waitForTimeout(150); // eslint-disable-line playwright/no-wait-for-timeout -- polling interval between DOM reads
  }
  return refs;
}

/** Requests every found URL and returns a description of each one that does not answer 200. */
export async function findBroken(page: Page, found: Map<string, string>): Promise<string[]> {
  const broken: string[] = [];
  for (const [href, foundOn] of found) {
    const response = await page.request.get(href);
    if (response.status() !== 200) broken.push(`${response.status()} ${href}  (linked from ${foundOn})`);
  }
  return broken;
}

/**
 * Crawls the site in a real browser starting at index.html. Only links and frames that point to
 * HTML pages are followed; stylesheets, scripts, images and downloads are recorded for checking.
 * External links and anything outside the site's base path are ignored.
 */
export async function crawl(page: Page, baseURL: string): Promise<CrawlResult> {
  const base = new URL(baseURL);

  /** Same site, inside the base path (so it also works under /TrainingWebsite/), without the #fragment. */
  const normalise = (raw: string): string | null => {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return null;
    url.hash = '';
    return url.href;
  };
  const isHtml = (href: string) => {
    const { pathname } = new URL(href);
    return pathname.endsWith('.html') || pathname.endsWith('/');
  };

  const queue = [new URL('index.html', base).href];
  const visited = new Set<string>();
  const found = new Map<string, string>();

  for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
    if (visited.has(url)) continue;
    visited.add(url);
    await page.goto(url);

    for (const ref of await collectStableRefs(page)) {
      const href = normalise(ref.url);
      if (!href) continue;
      if (!found.has(href)) found.set(href, url);
      if (ref.follow && isHtml(href) && !visited.has(href)) queue.push(href);
    }
  }
  return { visited, found };
}
