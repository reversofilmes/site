/**
 * Quando o conteúdo da faixa excede a largura (scroll horizontal visível),
 * aplica .projects-filter__track--overflow para mostrar setas à esquerda e à direita
 * e padding lateral nos botões.
 */
(function () {
  'use strict';

  var ATTR = 'data-filter-scroll-bound';
  var scheduled = new Set();

  function scheduleMeasure(track) {
    if (scheduled.has(track)) return;
    scheduled.add(track);
    requestAnimationFrame(function () {
      scheduled.delete(track);
      measureAndUpdate(track);
    });
  }

  function measureAndUpdate(track) {
    var scroll = track.querySelector('.projects-filter__scroll');
    if (!scroll) return;

    var tolerance = 2;
    var overflow = scroll.scrollWidth - scroll.clientWidth > tolerance;
    track.classList.toggle('projects-filter__track--overflow', overflow);
  }

  function bindTrack(track) {
    if (track.getAttribute(ATTR) === '1') return;
    track.setAttribute(ATTR, '1');

    var scroll = track.querySelector('.projects-filter__scroll');
    if (!scroll) return;

    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () {
        scheduleMeasure(track);
      });
      ro.observe(scroll);
    }

    var inner = scroll.querySelector('.projects-filter-service-btns');
    if (inner && typeof MutationObserver !== 'undefined') {
      var mo = new MutationObserver(function () {
        scheduleMeasure(track);
      });
      mo.observe(inner, { childList: true, subtree: true });
    }

    scheduleMeasure(track);
  }

  function scan() {
    document.querySelectorAll('.projects-filter__track').forEach(bindTrack);
  }

  function init() {
    scan();

    window.addEventListener('resize', function () {
      document.querySelectorAll('.projects-filter__track').forEach(scheduleMeasure);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        document.querySelectorAll('.projects-filter__track').forEach(scheduleMeasure);
      }
    });

    window.addEventListener('load', function () {
      document.querySelectorAll('.projects-filter__track').forEach(scheduleMeasure);
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
