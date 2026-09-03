// Connected-care diagram regression check (2026-08).
//
// The diagram is the primary explanation of what TrustyDr is, so the things
// that would quietly break it are worth pinning against a REAL browser rather
// than asserting that a CSS rule exists somewhere in the stylesheet:
//
//   - the narration actually advances (a stalled sequence still looks fine in
//     a screenshot, and is the most likely silent failure)
//   - the pulse and the lit node follow the active step
//   - clicking a step takes control and pauses
//   - it survives RTL, where the diagram is the same but the copy flips
//   - it degrades to a COMPLETE static story under prefers-reduced-motion,
//     not to an empty box
//   - it stays inside the viewport at mobile width (no horizontal scroll)
//
// Usage:
//   cd test && npm install && npm run test:ecosystem
//   BASE_URL=https://www.trustydr.com npm run test:ecosystem   (prod)
//   BASE_URL=http://127.0.0.1:8080    npm run test:ecosystem   (local: run
//     `python -m http.server 8080` from the repo root first)
//
// Not part of the deployed site (excluded via firebase.json's "ignore" and
// the repo .gitignore).

import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8080';

const LOCALES = [
  { code: 'en', dir: 'ltr', patient: 'Patient', lab: 'Laboratory' },
  { code: 'ar', dir: 'rtl', patient: 'المريض', lab: 'المختبر' },
  { code: 'ku', dir: 'rtl', patient: 'نەخۆش', lab: 'تاقیگە' },
];

const STEP_COUNT = 6;

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.log('  FAIL:', msg);
    failures++;
  } else {
    console.log('  ok:', msg);
  }
}

async function activeStepIndex(page) {
  return page.evaluate(() => {
    const steps = Array.from(document.querySelectorAll('[data-eco-step]'));
    return steps.findIndex((s) => s.classList.contains('is-active'));
  });
}

async function run() {
  console.log(`Testing against: ${BASE_URL}\n`);
  const browser = await chromium.launch();

  // ── Per-locale behaviour ────────────────────────────────────────────────
  for (const { code, dir, patient, lab } of LOCALES) {
    console.log(`=== ${code} (${dir}) @ 1280px ===`);
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${BASE_URL}/${code}/`, { waitUntil: 'networkidle' });

    const root = page.locator('[data-eco-root]');
    assert(await root.count() === 1, 'exactly one diagram on the page');
    await root.scrollIntoViewIfNeeded();

    assert(
      (await page.locator('html').getAttribute('dir')) === dir,
      `page direction is ${dir}`,
    );

    // Content is localized, not baked into an image.
    assert(await page.locator('[data-eco-node="patient"]').innerText()
      .then((t) => t.includes(patient)), `patient node is localized ("${patient}")`);
    assert(await page.locator('[data-eco-node="lab"]').innerText()
      .then((t) => t.includes(lab)), `laboratory node is localized ("${lab}")`);
    assert(await page.locator('[data-eco-step]').count() === STEP_COUNT,
      `${STEP_COUNT} workflow steps present`);

    // The single most valuable assertion: the story actually moves.
    const first = await activeStepIndex(page);
    assert(first >= 0, 'a step is active on load');
    await page.waitForTimeout(3200);
    const second = await activeStepIndex(page);
    assert(second !== first, `narration advances (${first} -> ${second})`);

    // The diagram follows the narration rather than animating independently.
    const followed = await page.evaluate(() => {
      const step = document.querySelector('[data-eco-step].is-active');
      if (!step) return { ok: false, why: 'no active step' };
      const edgeId = step.getAttribute('data-eco-edge');
      const edge = document.querySelector(`[data-eco-edge="${edgeId}"].ecoEdgeGroup`);
      const litNodes = (step.getAttribute('data-eco-nodes') || '').split(' ');
      const allLit = litNodes.every((n) =>
        document.querySelector(`[data-eco-node="${n}"]`)?.classList.contains('is-lit'));
      return { ok: !!edge && edge.classList.contains('is-active') && allLit, edgeId };
    });
    assert(followed.ok, `active step lights its own edge and nodes (${followed.edgeId})`);

    // Taking control must stop the carousel moving under the visitor.
    await page.locator('[data-eco-step]').nth(3).click();
    await page.waitForTimeout(150);
    assert(await activeStepIndex(page) === 3, 'clicking a step selects it');
    await page.waitForTimeout(3200);
    assert(await activeStepIndex(page) === 3, 'clicking a step pauses the narration');

    const toggle = page.locator('[data-eco-toggle]');
    assert(await toggle.isVisible(), 'pause/play control is available');
    assert((await toggle.getAttribute('aria-pressed')) === 'true',
      'control reports the paused state');

    await page.close();
    console.log('');
  }

  // ── Reduced motion ──────────────────────────────────────────────────────
  console.log('=== en @ prefers-reduced-motion: reduce ===');
  {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce',
    });
    await page.goto(`${BASE_URL}/en/`, { waitUntil: 'networkidle' });
    await page.locator('[data-eco-root]').scrollIntoViewIfNeeded();

    // The whole story must be readable at once, not blanked out.
    const opacities = await page.$$eval('[data-eco-step]', (els) =>
      els.map((e) => parseFloat(getComputedStyle(e).opacity)));
    assert(opacities.length === STEP_COUNT && opacities.every((o) => o > 0.95),
      'every step is fully legible with motion disabled');

    const edgesVisible = await page.$$eval('.ecoEdge', (els) =>
      els.every((e) => parseFloat(getComputedStyle(e).opacity) > 0.2));
    assert(edgesVisible, 'all connections are drawn with motion disabled');

    const pulseHidden = await page.$$eval('.ecoPulse', (els) =>
      els.every((e) => getComputedStyle(e).display === 'none'));
    assert(pulseHidden, 'travelling pulses are removed, not just paused');

    const before = await activeStepIndex(page);
    await page.waitForTimeout(3200);
    assert(await activeStepIndex(page) === before,
      'nothing auto-advances with motion disabled');

    await page.close();
    console.log('');
  }

  // ── Mobile ──────────────────────────────────────────────────────────────
  for (const code of ['en', 'ar']) {
    console.log(`=== ${code} @ 375px ===`);
    const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
    await page.goto(`${BASE_URL}/${code}/`, { waitUntil: 'networkidle' });
    await page.locator('[data-eco-root]').scrollIntoViewIfNeeded();

    const overflows = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert(!overflows, 'no horizontal page overflow at 375px');

    const stageBox = await page.locator('.ecoStage').boundingBox();
    assert(stageBox && stageBox.width <= 375, 'diagram fits the viewport width');
    assert(stageBox && stageBox.height > 120, 'diagram is still large enough to read');

    // Nodes must not collide once the stage shrinks.
    const boxes = await page.$$eval('.ecoNode', (els) =>
      els.map((e) => e.getBoundingClientRect()).map((r) => ({
        l: r.left, r: r.right, t: r.top, b: r.bottom,
      })));
    let overlap = false;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) overlap = true;
      }
    }
    assert(!overlap, 'nodes do not overlap at mobile width');

    await page.close();
    console.log('');
  }

  // ── The Explore CTA ──────────────────────────────────────────────────────
  //
  // This is the one action the ecosystem section asks for, and it used to
  // inherit the base .btn sizing meant for the coloured header bar: 13px text
  // in 10x14 padding, and - because .btn.primary outranks .ecoCta - a white
  // background on a light section. It measured 125x41 and read as a chip.
  //
  // Pinned by measurement rather than by CSS text, so any future change that
  // shrinks it back is caught however it is written.
  for (const { code, dir } of LOCALES) {
    for (const [w, h, label] of [[1280, 900, 'desktop'], [375, 800, 'mobile']]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(`${BASE_URL}/${code}/`, { waitUntil: 'networkidle' });
      console.log(`=== ${code} (${dir}) Explore CTA @ ${label} ===`);

      const cta = page.locator('.ecoCta');
      assert(await cta.count() === 1, 'the Explore CTA is on the page');

      const box = await cta.boundingBox();
      assert(box.height >= 46,
        `CTA is a real button, not a chip (${Math.round(box.height)}px tall)`);
      assert(box.width >= 150,
        `CTA has presence (${Math.round(box.width)}px wide)`);

      const style = await cta.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          font: parseFloat(s.fontSize),
          padX: parseFloat(s.paddingLeft),
          padY: parseFloat(s.paddingTop),
          gradient: s.backgroundImage.includes('gradient'),
          shadow: s.boxShadow !== 'none',
          cursor: s.cursor,
        };
      });
      assert(style.font >= 15, `CTA text is readable (${style.font}px)`);
      assert(style.padY >= 14 && style.padX >= 18,
        `CTA has real padding (${style.padY}x${style.padX})`);
      assert(style.gradient,
        'CTA carries the brand gradient, not the header bar white');
      assert(style.shadow, 'CTA is lifted off the section');
      assert(style.cursor === 'pointer', 'CTA looks clickable');

      // Localization and RTL are untouched by the restyle: it is CSS only, and
      // nothing in the rule is direction-specific.
      assert((await cta.getAttribute('href')) === `/${code}/explore/`,
        'CTA still links to this locale\'s Explore');
      assert(((await cta.innerText()) || '').trim().length > 0,
        'CTA keeps its localized label');

      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth);
      assert(!overflow, `no horizontal overflow at ${label}`);

      await page.close();
      console.log('');
    }
  }

  await browser.close();
  console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
  process.exit(failures > 0 ? 1 : 0);
}

run();
