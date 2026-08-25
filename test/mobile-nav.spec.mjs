// Mobile nav hamburger-to-X regression check (2026-08).
//
// Written after a real false alarm: a mobile test appeared to show the
// hamburger icon never changing to an X in production, when the actual
// cause was a residual browser-cache entry predating an unrelated
// Cache-Control fix — the deployed code was already correct the whole
// time. This check proves that directly, against a REAL browser (not just
// asserting a CSS rule exists in the stylesheet text), so the next time
// this class of question comes up it can be answered in seconds instead
// of re-diagnosed from scratch.
//
// Asserts, per locale, against a real rendered page:
//   - aria-expanded flips false -> true -> false
//   - the menu panel actually opens (class + visibility)
//   - the three .navToggleBar spans reach the expected computed
//     transform/opacity (not just "a CSS rule exists that could match")
//   - Escape closes and returns focus
//   - clicking a nav link closes the panel
// Saves a screenshot of the open state per locale as visual proof.
//
// Usage:
//   cd test && npm install && npm run test:mobile-nav
//   BASE_URL=https://www.trustydr.com npm run test:mobile-nav   (prod)
//   BASE_URL=http://127.0.0.1:8080    npm run test:mobile-nav   (local: run `python -m http.server 8080` from the repo root first)
//
// Not part of the deployed site (excluded via firebase.json's own
// "ignore": ["**/node_modules/**"] and the repo's .gitignore).

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8080';

const LOCALES = [
  { code: 'en', label_open: 'Open menu', label_close: 'Close menu' },
  { code: 'ar', label_open: 'فتح القائمة', label_close: 'إغلاق القائمة' },
  { code: 'ku', label_open: 'کردنەوەی لیست', label_close: 'داخستنی لیست' },
];

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.log('  FAIL:', msg);
    failures++;
  } else {
    console.log('  ok:', msg);
  }
}

async function run() {
  console.log(`Testing against: ${BASE_URL}\n`);
  const browser = await chromium.launch();

  for (const { code, label_open, label_close } of LOCALES) {
    console.log(`=== ${code} @ 375px ===`);
    const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
    await page.goto(`${BASE_URL}/${code}/`, { waitUntil: 'networkidle' });

    const toggle = page.locator('.navToggle');
    const menu = page.locator('#primaryMenu');
    const bars = page.locator('.navToggleBar');

    assert((await toggle.getAttribute('aria-expanded')) === 'false', 'starts closed (aria-expanded=false)');
    assert((await toggle.getAttribute('aria-label')) === label_open, `starts with open-label "${label_open}"`);

    await toggle.click();
    await page.waitForTimeout(300); // let the .18s CSS transition finish before reading computed styles

    assert((await toggle.getAttribute('aria-expanded')) === 'true', 'opens (aria-expanded=true)');
    assert((await toggle.getAttribute('aria-label')) === label_close, `switches to close-label "${label_close}"`);
    assert(await menu.evaluate((el) => el.classList.contains('open')), 'menu panel has .open class');
    assert(await menu.isVisible(), 'menu panel is actually visible');

    const [b1, b2, b3] = await bars.evaluateAll((els) =>
      els.map((el) => ({ transform: getComputedStyle(el).transform, opacity: getComputedStyle(el).opacity })),
    );
    assert(b1.transform !== 'none' && b1.transform !== 'matrix(1, 0, 0, 1, 0, 0)', `top bar visually rotated (${b1.transform})`);
    assert(parseFloat(b2.opacity) < 0.05, `middle bar faded out (opacity=${b2.opacity})`);
    assert(b3.transform !== 'none' && b3.transform !== 'matrix(1, 0, 0, 1, 0, 0)', `bottom bar visually rotated (${b3.transform})`);

    await page.screenshot({ path: path.join(HERE, `screenshot-${code}-open.png`) });

    await page.keyboard.press('Escape');
    assert((await toggle.getAttribute('aria-expanded')) === 'false', 'Escape closes it');
    assert(await page.evaluate(() => document.activeElement.classList.contains('navToggle')), 'Escape returns focus to the toggle');

    await toggle.click();
    await menu.locator('a').first().click();
    await page.waitForTimeout(50);
    const closedAfterLinkClick = await page
      .evaluate(() => {
        const m = document.getElementById('primaryMenu');
        return m ? !m.classList.contains('open') : true;
      })
      .catch(() => true); // page may have navigated away entirely, which is also "closed"
    assert(closedAfterLinkClick, 'clicking a nav link closes the panel');

    await page.close();
    console.log('');
  }

  await browser.close();
  console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
  process.exit(failures > 0 ? 1 : 0);
}

run();
