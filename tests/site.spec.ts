import { expect, test } from '@playwright/test';
import { readdirSync } from 'node:fs';

test('every published decision has a readable page linked from the library', async ({
  page,
  request,
}) => {
  await page.goto('/');
  for (const file of readdirSync('adr').filter((file) =>
    file.endsWith('.md'),
  )) {
    const slug = file.replace(/\.md$/, '');
    const href = `/decisions/${slug}/`;
    await expect(page.locator(`#library a[href="${href}"]`)).toHaveCount(1);
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
    const html = await response.text();
    expect(html, href).toContain('id="context"');
    expect(html, href).toContain('id="decision"');
    expect(html, href).toContain('Consequences');
    expect(html, href).toContain(`ADR ${file.slice(0, 4)}`);
  }
});

test('readers can combine full-text search with topics, reset, and share a filtered view', async ({
  page,
}) => {
  await page.goto('/#library');
  const rows = page.locator('[data-record]');
  const session = page.locator('[data-record][href*="0061-"]');
  await page
    .getByRole('searchbox', { name: 'Search decisions' })
    .fill('session lock');
  await expect(session).toBeVisible();
  await expect(page.locator('[data-record][href*="0002-"]')).toBeHidden();
  await page.getByRole('searchbox').fill('');
  await page
    .getByRole('button', {
      name: 'Secrets, access, and perimeter',
      exact: true,
    })
    .click();
  await expect(session).toBeHidden();
  await expect(page.locator('[data-record][href*="0018-"]')).toBeVisible();
  await page.getByRole('searchbox').fill('runtime injected');
  await expect(page.locator('[data-record][href*="0018-"]')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue('runtime injected');
  await expect(
    page.getByRole('button', {
      name: 'Secrets, access, and perimeter',
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page
    .getByRole('searchbox')
    .fill('a phrase that no decision contains 987654');
  await expect(
    page.getByRole('heading', { name: 'No decisions match.' }),
  ).toBeVisible();
  await expect(page.locator('#result-count')).toHaveText('0 decisions');
  await page.getByRole('button', { name: 'Reset search and filters' }).click();
  await expect(rows.filter({ visible: true })).toHaveCount(
    readdirSync('adr').filter((file) => file.endsWith('.md')).length,
  );
});

test('local links, images, scripts, styles, and section anchors resolve', async ({
  page,
  request,
}) => {
  const paths = [
    '/',
    '/about/',
    '/case-study/',
    '/threat-model/',
    '/checklist/',
    '/observability/',
    ...readdirSync('adr')
      .filter((file) => file.endsWith('.md'))
      .map((file) => `/decisions/${file.slice(0, -3)}/`),
  ];
  await page.goto('/');
  const cache = new Map<string, { ids: string[]; links: string[] }>();
  async function load(path: string) {
    if (!cache.has(path)) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      const html = await response.text();
      const document = await page.evaluate((html) => {
        const document = new DOMParser().parseFromString(html, 'text/html');
        return {
          ids: [...document.querySelectorAll('[id]')].map(
            (element) => element.id,
          ),
          links: [
            ...document.querySelectorAll(
              'a[href], img[src], script[src], link[rel="stylesheet"]',
            ),
          ].map(
            (element) =>
              element.getAttribute('href') ?? element.getAttribute('src')!,
          ),
        };
      }, html);
      cache.set(path, document);
    }
    return cache.get(path)!;
  }
  for (const path of paths) {
    for (const link of (await load(path)).links) {
      const url = new URL(link, `http://127.0.0.1:4321${path}`);
      if (url.origin !== 'http://127.0.0.1:4321') continue;
      const target = await load(url.pathname);
      if (url.hash)
        expect(target.ids, `${path} -> ${link}`).toContain(
          decodeURIComponent(url.hash.slice(1)),
        );
    }
  }
});

test('the complete collection is readable without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321/');
  await expect(page.locator('[data-record]')).toHaveCount(
    readdirSync('adr').filter((file) => file.endsWith('.md')).length,
  );
  await page.locator('[data-record][href*="0061-"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Release the session lock before slow work',
  );
  await context.close();
});

test('the home and record pages fit a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of [
    '/',
    '/about/',
    '/decisions/0030-immutable-releases-atomic-promotion-append-only-journal/',
  ]) {
    await page.goto(path);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(375);
  }
});
