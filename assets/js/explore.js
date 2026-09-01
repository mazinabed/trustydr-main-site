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
    if (!tabs.length || !panels.length) return;

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

    // Allow /explore/#pharmacy to open on that track — used by the links from
    // the portal's login page and anywhere else that wants to point at one
    // platform in particular.
    var hash = (window.location.hash || '').replace('#', '');
    if (hash && tabs.some(function (t) { return t.getAttribute('data-tour-tab') === hash; })) {
      select(hash, false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
