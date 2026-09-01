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

// Which tracks are published is data-driven now: a platform with no approved
// screenshots is not rendered at all. The suite asserts the RULE, not a fixed
// list, so adding Pharmacy tomorrow does not require editing this file.
const MUST_BE_PUBLISHED = ['doctor'];

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
    // The platform must be named whether or not the picker is rendered.
    const hasPicker = (await page.locator('.tourPick').count()) > 0;
    if (hasPicker) {
      assert((await page.locator('.tourPick').innerText()).trim() === pick,
        'picker heading is localized');
      assert((await page.locator('[data-tour-tab="doctor"]').innerText()).includes(doctor),
        'track name is localized');
    } else {
      assert((await page.locator('[data-tour-track-name]').innerText()).includes(doctor),
        'the single track is named and localized');
    }

    const published = await page.$$eval('[data-tour-panel]',
      (els) => els.map((e) => e.getAttribute('data-tour-panel')));

    for (const id of MUST_BE_PUBLISHED) {
      assert(published.includes(id), `${id} track is published`);
    }

    // -- THE PRODUCTION RULE ----------------------------------------------
    // Doctors arrive here from live advertising. A placeholder frame would
    // advertise an unfinished product, so nothing may render without a real
    // approved screenshot.
    const placeholders = await page.locator('.tourShot--placeholder').count();
    assert(placeholders === 0, `ZERO placeholders rendered (found ${placeholders})`);

    const emptySrc = await page.$$eval('img.tourShot',
      (els) => els.filter((e) => !e.getAttribute('src')).length);
    assert(emptySrc === 0, 'no screenshot renders without a source');

    const shots = await page.locator('img.tourShot').count();
    console.log(`  (${published.length} track(s), ${shots} real screenshots)`);

    // Every published step must carry an image - no bare text steps either.
    for (const id of published) {
      const steps = await page.locator(`[data-tour-panel="${id}"] .tourStep`).count();
      const imgs = await page.locator(`[data-tour-panel="${id}"] img.tourShot`).count();
      assert(steps > 0, `${id} track has steps`);
      assert(steps === imgs,
        `${id}: every step has a real screenshot (${steps} steps, ${imgs} images)`);
    }

    // A track with nothing to show must not be reachable at all - no tab, no
    // panel, and no deep link into an empty experience.
    for (const id of ['pharmacy', 'laboratory']) {
      if (published.includes(id)) continue;
      assert(await page.locator(`[data-tour-tab="${id}"]`).count() === 0,
        `${id} has no tab while unpublished`);
      assert(await page.locator(`[data-tour-panel="${id}"]`).count() === 0,
        `${id} has no panel while unpublished`);
      await page.goto(`${BASE_URL}/${code}/explore/#${id}`, { waitUntil: 'networkidle' });
      assert(await page.locator('.tourStep').count() > 0,
        `deep-linking #${id} still shows real content, not an empty page`);
      assert(await page.locator('.tourShot--placeholder').count() === 0,
        `deep-linking #${id} shows no placeholder`);
    }

    for (let i = 0; i < shots; i++) {
      const alt = await page.locator('img.tourShot').nth(i).getAttribute('alt');
      assert(!!alt && alt.trim().length > 0, `screenshot ${i + 1} has alt text`);
    }

    // Multi-track behaviour is only assertable once a second track publishes.
    if (published.length > 1) {
      const a = published[0], b = published[1];
      await page.goto(`${BASE_URL}/${code}/explore/`, { waitUntil: 'networkidle' });
      assert(await page.locator(`[data-tour-panel="${a}"]`).isVisible(), 'first track visible');
      assert(!(await page.locator(`[data-tour-panel="${b}"]`).isVisible()),
        'other tracks hidden initially');
      await page.locator(`[data-tour-tab="${b}"]`).click();
      assert(await page.locator(`[data-tour-panel="${b}"]`).isVisible(), 'switching tracks works');
      assert((await page.locator(`[data-tour-tab="${b}"]`).getAttribute('aria-selected')) === 'true',
        'aria-selected follows the active track');
      const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      await page.locator(`[data-tour-tab="${b}"]`).focus();
      await page.keyboard.press(forward);
      assert(await page.locator('[data-tour-panel].is-active').count() === 1,
        `${forward} moves between tracks in ${dir}`);
    } else {
      // One track: the picker is noise and must not be rendered.
      assert(await page.locator('.tourTabs').count() === 0,
        'no platform picker while only one track is published');
      console.log('  (single track - picker correctly omitted)');
    }

    // -- Lightbox ----------------------------------------------------------
    await page.goto(`${BASE_URL}/${code}/explore/`, { waitUntil: 'networkidle' });
    const lightbox = page.locator('[data-tour-lightbox]');
    assert(await lightbox.count() === 1, 'lightbox markup present');
    assert(!(await lightbox.isVisible()), 'lightbox starts closed');

    const firstShot = page.locator('[data-tour-zoom]').first();
    await firstShot.scrollIntoViewIfNeeded();
    await firstShot.click();
    assert(await lightbox.isVisible(), 'clicking a screenshot opens it full size');

    const openedSrc = await page.locator('[data-tour-lightbox-img]').getAttribute('src');
    assert(!!openedSrc && openedSrc.includes('/assets/img/tour/'),
      'the full-size image is loaded');
    assert(await page.evaluate(() =>
      document.body.classList.contains('tourLightboxOpen')),
      'background scroll is locked while open');
    assert(await page.evaluate(() =>
      document.activeElement === document.querySelector('[data-tour-lightbox-close]')),
      'focus moves to the close button');

    await page.keyboard.press('Escape');
    assert(!(await lightbox.isVisible()), 'Escape closes the lightbox');
    assert(await page.evaluate(() =>
      !document.body.classList.contains('tourLightboxOpen')),
      'scroll lock is released');
    assert(await page.evaluate(() =>
      document.activeElement && document.activeElement.hasAttribute('data-tour-zoom')),
      'focus returns to the screenshot that opened it');

    await firstShot.click();
    await page.locator('[data-tour-lightbox-close]').click();
    assert(!(await lightbox.isVisible()), 'the close button closes it');

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
    const njSteps = await page.locator('.tourStep').count();
    const njImgs = await page.locator('img.tourShot').count();
    assert(njSteps > 0 && njSteps === njImgs,
      `all ${njSteps} steps and their screenshots are in the served HTML`);
    assert(await page.locator('.tourShot--placeholder').count() === 0,
      'no placeholder in the served HTML either');
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
    assert(await page.locator('.tourStep').first().isVisible(), 'tour readable on mobile');
    assert(await page.locator('.tourShot--placeholder').count() === 0,
      'no placeholder at mobile width');
    await page.close();
    console.log('');
  }

  await browser.close();
  console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
  process.exit(failures > 0 ? 1 : 0);
}

run();
