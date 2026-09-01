/* TrustyDr connected-care diagram — narration driver.
   ---------------------------------------------------------------------------
   Walks a fixed sequence of real TrustyDr workflows, lighting one connection at
   a time. Every string lives in the page markup (this site localises by having
   one HTML file per locale), so this file carries no copy at all.

   Sequence and edges are declared in the markup via data attributes, so a step
   can be reordered or reworded without touching this script.

   Honours prefers-reduced-motion: the CSS already renders the complete static
   story, and this script then does nothing at all rather than silently mutating
   classes nobody can see. */
(function () {
  'use strict';

  var STEP_MS = 2600;

  function init(root) {
    var steps = Array.prototype.slice.call(root.querySelectorAll('[data-eco-step]'));
    var edges = Array.prototype.slice.call(root.querySelectorAll('[data-eco-edge]'));
    var nodes = Array.prototype.slice.call(root.querySelectorAll('[data-eco-node]'));
    var toggle = root.querySelector('[data-eco-toggle]');
    if (!steps.length || !edges.length) return;

    var reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Static state: CSS shows everything at once. Nothing to drive.
    if (reduce) return;

    var index = -1;
    var timer = null;
    var playing = true;

    function edgeById(id) {
      for (var i = 0; i < edges.length; i++) {
        if (edges[i].getAttribute('data-eco-edge') === id) return edges[i];
      }
      return null;
    }

    function clear() {
      edges.forEach(function (e) {
        e.classList.remove('is-active', 'is-reverse');
      });
      nodes.forEach(function (n) { n.classList.remove('is-lit'); });
      steps.forEach(function (s) { s.classList.remove('is-active'); });
    }

    function show(i) {
      clear();
      var step = steps[i];
      if (!step) return;

      step.classList.add('is-active');

      var edge = edgeById(step.getAttribute('data-eco-edge'));
      if (edge) {
        // Restart the CSS animation: without the reflow the class re-add is
        // coalesced and the pulse never replays on a repeat cycle.
        edge.classList.remove('is-active', 'is-reverse');
        void edge.getBoundingClientRect();
        edge.classList.add('is-active');
        if (step.getAttribute('data-eco-reverse') === 'true') {
          edge.classList.add('is-reverse');
        }
      }

      var lit = (step.getAttribute('data-eco-nodes') || '').split(' ');
      nodes.forEach(function (n) {
        if (lit.indexOf(n.getAttribute('data-eco-node')) !== -1) {
          n.classList.add('is-lit');
        }
      });
    }

    function advance() {
      index = (index + 1) % steps.length;
      show(index);
    }

    function play() {
      playing = true;
      if (toggle) {
        toggle.setAttribute('aria-pressed', 'false');
        toggle.textContent = toggle.getAttribute('data-label-pause') || 'Pause';
      }
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(advance, STEP_MS);
    }

    function pause() {
      playing = false;
      if (toggle) {
        toggle.setAttribute('aria-pressed', 'true');
        toggle.textContent = toggle.getAttribute('data-label-play') || 'Play';
      }
      if (timer) { window.clearInterval(timer); timer = null; }
    }

    if (toggle) {
      toggle.hidden = false;
      toggle.addEventListener('click', function () {
        if (playing) { pause(); } else { play(); advance(); }
      });
    }

    // Let a visitor jump straight to a step; also makes the narration usable
    // with a keyboard rather than being a thing that only happens at you.
    steps.forEach(function (step, i) {
      step.addEventListener('click', function () {
        pause();
        index = i;
        show(i);
      });
      step.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          pause();
          index = i;
          show(i);
        }
      });
    });

    // Don't animate off-screen: saves work on long pages and means a visitor
    // who scrolls down mid-cycle still sees the sequence from a sensible point.
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            if (playing && !timer) { play(); }
          } else if (timer) {
            window.clearInterval(timer);
            timer = null;
          }
        });
      }, { threshold: 0.25 });
      io.observe(root);
    }

    advance();
    play();
  }

  function boot() {
    Array.prototype.slice
      .call(document.querySelectorAll('[data-eco-root]'))
      .forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
