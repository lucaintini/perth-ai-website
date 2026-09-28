// Layout and rotation checks for Quokka Run (/ddd-2026), run in GitHub Actions.
// Kristina's review (28 Sep 2026) caught two gaps in the earlier test: it used an
// EMPTY leaderboard and only checked iPads, so it missed that a full board made
// the booth screen scroll. This version stubs a FULL 10-row board and asserts the
// booth and iPad never need scrolling to reach Start, plus the portrait ground
// fix and mid-run rotation.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const OUT = 'test-results/shots';
fs.mkdirSync(OUT, { recursive: true });
const url = (base) => `${base}/ddd-2026/?booth#runner`;

const CONFIG = {
  eventName: 'DDD Perth 2026', eventDate: '3 October', idleSeconds: 0, attractSeconds: 0,
  onScreenKeyboard: true,
  game: { prize: 'Top score at 4pm wins a prize, plus a random draw for everyone who plays' },
  links: { luma: 'https://luma.com/perthai', slack: 'https://x', linkedin: 'https://x', email: 'x@x' },
  team: [], forms: { endpoint: 'https://x', accessKey: 't', subjectPrefix: 't', fromName: 't' },
};
// A FULL board, the case the earlier test missed.
const FULL_BOARD = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Player ${i + 1}`, score: 9000 - i * 500 }));

test.beforeEach(async ({ page }) => {
  await page.route('**/api/config.json', (r) => r.fulfill({ json: CONFIG }));
  await page.route('**/api/scores**', (r) => r.fulfill({ json: FULL_BOARD }));
  await page.route('**/api/qr/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }));
});

// Booth screen and tablets must never need scrolling to reach Start (the kiosk rule).
for (const [name, w, h] of [['booth-1080', 1920, 1080], ['ipad-landscape', 1180, 820], ['ipad-portrait', 820, 1180]]) {
  test(`${name}: Start and full leaderboard fit on screen, no scroll`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('http://127.0.0.1:4321/ddd-2026/?booth#runner');
    await page.waitForSelector('.btn-start');
    await page.waitForTimeout(600);
    const start = await page.locator('.btn-start').boundingBox();
    const board = await page.locator('.board').boundingBox();
    expect(start.y + start.height, `${name}: Start button is on screen`).toBeLessThanOrEqual(h + 1);
    expect(board.y + board.height, `${name}: full leaderboard is on screen`).toBeLessThanOrEqual(h + 1);
    // The intro panel must not have an internal scrollbar on booth/tablet.
    const panelScrolls = await page.evaluate(() => {
      const p = document.querySelector('.runner-panel');
      return p ? p.scrollHeight > p.clientHeight + 1 : false;
    });
    expect(panelScrolls, `${name}: intro panel does not scroll`).toBeFalsy();
    await page.screenshot({ path: `${OUT}/${name}-intro.png` });
  });
}

test('phone-landscape: Start button is on screen (via #26 layout)', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('http://127.0.0.1:4321/ddd-2026/?booth#runner');
  await page.waitForSelector('.btn-start');
  await page.waitForTimeout(600);
  const start = await page.locator('.btn-start').boundingBox();
  expect(start.y).toBeGreaterThanOrEqual(0);
  expect(start.y + start.height).toBeLessThanOrEqual(390 + 1);
  await page.screenshot({ path: `${OUT}/phone-landscape-intro.png` });
});

for (const [name, w, h] of [['phone-portrait', 390, 844], ['ipad-portrait', 820, 1180]]) {
  test(`${name}: ground sits low, never mid-screen`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('http://127.0.0.1:4321/ddd-2026/?booth#runner');
    await page.waitForSelector('.runner-canvas');
    await page.waitForTimeout(600);
    const gpx = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.runner')).getPropertyValue('--ground-px')) || 0);
    const groundFromTop = (h - gpx) / h;
    expect(groundFromTop, 'ground fraction from top').toBeGreaterThan(0.60);
    expect(groundFromTop).toBeLessThan(0.86);
  });
}

test('rotating mid-run keeps the run alive', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4321/ddd-2026/?booth#runner');
  await page.waitForSelector('[data-start]');
  await page.click('[data-start]');
  await page.waitForTimeout(1200);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(1000);
  await expect(page.locator('.runner.playing')).toHaveCount(1);
  await expect(page.locator('.results-panel')).toHaveCount(0);
});
