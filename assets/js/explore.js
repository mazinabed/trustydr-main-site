/* Explore TrustyDr — platform picker.
   ---------------------------------------------------------------------------
   Progressive enhancement only. The generated HTML already contains all three
   tracks; this just hides the ones you are not looking at and wires the
   keyboard behaviour a tablist is expected to have. With JavaScript disabled
   the first track is visible and the others are reachable in the markup, which
   is a worse experience but never a blank page.

   Carries no copy: every string is generated into the page per locale. */
(function () {
  'use strict';

  function init() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-tour-tab]'));
    var panels = Array.prototype.slice.call(document.querySelectorAll('[data-tour-panel]'));

    // The picker is omitted when only one platform has published screenshots,
    // so the lightbox has to be wired up regardless of whether tabs exist.
    if (!tabs.length || !panels.length) {
      initLightbox();
      return;
    }

    function select(id, focus) {
      tabs.forEach(function (tab) {
        var on = tab.getAttribute('data-tour-tab') === id;
        tab.classList.toggle('is-active', on);
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        // Roving tabindex: one stop for the whole group, arrows move within it.
        tab.setAttribute('tabindex', on ? '0' : '-1');
        if (on && focus) tab.focus();
      });
      panels.forEach(function (panel) {
        var on = panel.getAttribute('data-tour-panel') === id;
        panel.classList.toggle('is-active', on);
        panel.hidden = !on;
      });
    }

    tabs.forEach(function (tab, i) {
      tab.setAttribute('tabindex', tab.getAttribute('aria-selected') === 'true' ? '0' : '-1');

      tab.addEventListener('click', function () {
        select(tab.getAttribute('data-tour-tab'), false);
        // Deep-linkable without adding a history entry per click.
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', '#' + tab.getAttribute('data-tour-tab'));
        }
      });

      tab.addEventListener('keydown', function (ev) {
        var next = null;
        // Arrow direction follows the writing direction, so Right means
        // "onward" in English and "back" in Arabic, as a reader expects.
        var rtl = document.documentElement.getAttribute('dir') === 'rtl';
        var forward = rtl ? 'ArrowLeft' : 'ArrowRight';
        var back = rtl ? 'ArrowRight' : 'ArrowLeft';

        if (ev.key === forward) next = (i + 1) % tabs.length;
        else if (ev.key === back) next = (i - 1 + tabs.length) % tabs.length;
        else if (ev.key === 'Home') next = 0;
        else if (ev.key === 'End') next = tabs.length - 1;
        if (next === null) return;

        ev.preventDefault();
        select(tabs[next].getAttribute('data-tour-tab'), true);
      });
    });

    initLightbox();

    // Allow /explore/#pharmacy to open on that track — used by the links from
    // the portal's login page and anywhere else that wants to point at one
    // platform in particular.
    var hash = (window.location.hash || '').replace('#', '');
    if (hash && tabs.some(function (t) { return t.getAttribute('data-tour-tab') === hash; })) {
      select(hash, false);
    }
  }

  /// Click / tap a screenshot to see it full size.
  ///
  /// The captures are desktop-width UI, so at phone widths the inline image is
  /// legible as a shape but not as a screen. This is the difference between
  /// "there is a dashboard" and "I can see what the dashboard does".
  function initLightbox() {
    var box = document.querySelector('[data-tour-lightbox]');
    if (!box) return;

    var img = box.querySelector('[data-tour-lightbox-img]');
    var caption = box.querySelector('[data-tour-lightbox-caption]');
    var closeBtn = box.querySelector('[data-tour-lightbox-close]');
    var opener = null;

    function open(trigger) {
      var full = trigger.getAttribute('data-tour-full');
      var thumb = trigger.querySelector('img');
      if (!full) return;

      opener = trigger;
      img.setAttribute('src', full);
      img.setAttribute('alt', thumb ? thumb.getAttribute('alt') || '' : '');
      caption.textContent = thumb ? thumb.getAttribute('alt') || '' : '';
      box.hidden = false;
      document.body.classList.add('tourLightboxOpen');
      closeBtn.focus();
    }

    function close() {
      box.hidden = true;
      document.body.classList.remove('tourLightboxOpen');
      img.setAttribute('src', '');
      // Return focus where it came from, or the keyboard user is dumped at the
      // top of the document.
      if (opener) { opener.focus(); opener = null; }
    }

    Array.prototype.slice.call(document.querySelectorAll('[data-tour-zoom]'))
      .forEach(function (trigger) {
        trigger.addEventListener('click', function () { open(trigger); });
      });

    closeBtn.addEventListener('click', close);

    // Clicking the backdrop closes; clicking the image itself must not.
    box.addEventListener('click', function (ev) {
      if (ev.target === box) close();
    });

    document.addEventListener('keydown', function (ev) {
      if (box.hidden) return;
      if (ev.key === 'Escape') {
        ev.preventDefault();
        close();
        return;
      }
      // Keep focus inside the dialog: the close button is the only stop, so
      // Tab simply returns to it rather than escaping to the page behind.
      if (ev.key === 'Tab') {
        ev.preventDefault();
        closeBtn.focus();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
