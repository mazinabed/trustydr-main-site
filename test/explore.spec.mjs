// Explore TrustyDr product-tour regression check (2026-08).
//
// The tour is generated from content/tour.json, so the risks are structural
// rather than visual: a locale silently missing a track, a placeholder shipped
// as if it were a real screenshot, tabs that hide content from no-JS visitors,
// or a page that only works in English.
//
// Also pins the promise the page makes: it must never require an account, and
// it must never link a visitor into an authenticated application route.
//
// Usage:
//   cd test && npm install && npm run test:explore
//   BASE_URL=http://127.0.0.1:8080 npm run test:explore

import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8080';

const LOCALES = [
  { code: 'en', dir: 'ltr', pick: 'Choose a platform', doctor: 'Doctor Portal' },
  { code: 'ar', dir: 'rtl', pick: 'اختر المنصة', doctor: 'بوابة الأطباء' },
  { code: 'ku', dir: 'rtl', pick: 'پلاتفۆرمێک هەڵبژێرە', doctor: 'پۆرتاڵی پزیشک' },
];

const TRACKS = ['doctor', 'pharmacy', 'laboratory'];

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log('  FAIL:', msg); failures++; }
  else { console.log('  ok:', msg); }
}

async function run() {
  console.log(`Testing against: ${BASE_URL}\n`);
  const browser = await chromium.launch();

  for (const { code, dir, pick, doctor } of LOCALES) {
    console.log(`=== ${code} (${dir}) ===`);
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const resp = await page.goto(`${BASE_URL}/${code}/explore/`, { waitUntil: 'networkidle' });

    assert(resp && resp.ok(), 'page loads');
    assert((await page.locator('html').getAttribute('dir')) === dir, `direction is ${dir}`);
    assert((await page.locator('html').getAttribute('lang')) === code, `lang is ${code}`);

    // Localized, not an English page with a translated title.
    assert((await page.locator('.tourPick').innerText()).trim() === pick,
      'picker heading is localized');
    assert((await page.locator('[data-tour-tab="doctor"]').innerText()).includes(doctor),
      'track name is localized');

    for (const id of TRACKS) {
      assert(await page.locator(`[data-tour-tab="${id}"]`).count() === 1,
        `${id} track present`);
    }

    // Every track must actually carry steps — an empty track would render as a
    // bare CTA and still look "fine".
    for (const id of TRACKS) {
      const n = await page.locator(`[data-tour-panel="${id}"] .tourStep`).count();
      assert(n >= 5, `${id} track has ${n} steps`);
    }

    // Tabs
    assert(await page.locator('[data-tour-panel="doctor"]').isVisible(), 'first track visible');
    assert(!(await page.locator('[data-tour-panel="pharmacy"]').isVisible()),
      'other tracks hidden initially');

    await page.locator('[data-tour-tab="pharmacy"]').click();
    assert(await page.locator('[data-tour-panel="pharmacy"]').isVisible(), 'switching tracks works');
    assert(!(await page.locator('[data-tour-panel="doctor"]').isVisible()), 'previous track hides');
    assert((await page.locator('[data-tour-tab="pharmacy"]').getAttribute('aria-selected')) === 'true',
      'aria-selected follows the active track');

    // Keyboard: arrows follow writing direction.
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    await page.locator('[data-tour-tab="pharmacy"]').focus();
    await page.keyboard.press(forward);
    assert(await page.locator('[data-tour-panel="laboratory"]').isVisible(),
      `${forward} moves to the next track in ${dir}`);

    // Deep link, used by the portal login page.
    await page.goto(`${BASE_URL}/${code}/explore/#laboratory`, { waitUntil: 'networkidle' });
    assert(await page.locator('[data-tour-panel="laboratory"]').isVisible(),
      'hash deep-link opens that track');

    // A placeholder must announce itself, never masquerade as a screenshot.
    const placeholders = await page.locator('.tourShot--placeholder').count();
    const shots = await page.locator('img.tourShot').count();
    console.log(`  (${shots} real screenshots, ${placeholders} placeholders)`);
    if (placeholders) {
      const label = await page.locator('.tourShot--placeholder').first().getAttribute('aria-label');
      assert(!!label && label.length > 0, 'placeholders are labelled for assistive tech');
    }
    for (let i = 0; i < shots; i++) {
      const alt = await page.locator('img.tourShot').nth(i).getAttribute('alt');
      assert(!!alt && alt.trim().length > 0, `screenshot ${i + 1} has alt text`);
    }

    // The whole point: no account required, and no authenticated route linked.
    const hrefs = await page.$$eval('main a[href]', (els) => els.map((e) => e.getAttribute('href')));
    const leaked = hrefs.filter((h) =>
      /\/(dashboard|center|doctor\/(appointments|schedule|profile)|pharmacy\/dashboard|lab\/billing)/.test(h || ''));
    assert(leaked.length === 0, `no authenticated app routes linked (${leaked.join(', ') || 'none'}`);

    await page.close();
    console.log('');
  }

  // No-JS: the generated HTML must still carry the content.
  console.log('=== en with JavaScript disabled ===');
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/en/explore/`, { waitUntil: 'domcontentloaded' });
    assert(await page.locator('.tourStep').count() >= 15,
      'all steps are present in the served HTML, not assembled by script');
    assert(await page.locator('[data-tour-panel="doctor"]').isVisible(),
      'the first track is readable without JavaScript');
    await ctx.close();
    console.log('');
  }

  // Mobile
  console.log('=== ar @ 375px ===');
  {
    const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
    await page.goto(`${BASE_URL}/ar/explore/`, { waitUntil: 'networkidle' });
    const overflows = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert(!overflows, 'no horizontal overflow at 375px');
    assert(await page.locator('[data-tour-tab="doctor"]').isVisible(), 'picker usable on mobile');
    await page.close();
    console.log('');
  }

  await browser.close();
  console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
  process.exit(failures > 0 ? 1 : 0);
}

run();
