/**
 * Marquee de logos — modo estático quando cabe na tela; marquee infinito só com overflow.
 * Velocidade fixa em px/s, calibrada com o manifesto da Home.
 */
(function () {
  "use strict";

  var track = document.querySelector(".home-sobre-logos-marquee__track");
  var viewport = document.querySelector(".home-sobre-logos-marquee__viewport");
  var firstGroup = track && track.querySelector(".home-sobre-logos-marquee__group");
  if (!track || !viewport || !firstGroup) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var MANIFESTO_DURATION_S = 30;
  var resizeTimer = null;
  var lastMode = null;
  var lastShiftPx = 0;

  function manifestoPxPerSecond() {
    var manifestoTrack = document.querySelector(".home-manifesto-marquee__track");
    if (!manifestoTrack || manifestoTrack.scrollWidth < 2) return 120;
    return manifestoTrack.scrollWidth / 2 / MANIFESTO_DURATION_S;
  }

  function segmentWidthPx() {
    return Math.ceil(firstGroup.getBoundingClientRect().width);
  }

  function removeClones() {
    track.querySelectorAll(".home-sobre-logos-marquee__group.is-clone").forEach(function (node) {
      node.remove();
    });
  }

  function ensureMarqueeClone() {
    removeClones();
    var clone = firstGroup.cloneNode(true);
    clone.classList.add("is-clone");
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll("img").forEach(function (img) {
      img.alt = "";
    });
    track.appendChild(clone);
  }

  function hardRestartAnimation() {
    track.style.animation = "none";
    void track.offsetWidth;
    track.style.animation = "";
  }

  function setStaticMode() {
    removeClones();
    track.classList.remove("is-marquee-synced");
    track.classList.add("is-static");
    viewport.classList.add("is-static");
    track.style.removeProperty("--marquee-shift");
    track.style.removeProperty("--marquee-duration");
    hardRestartAnimation();
    lastMode = "static";
    lastShiftPx = 0;
  }

  function setMarqueeMode() {
    track.classList.remove("is-static");
    viewport.classList.remove("is-static");
    ensureMarqueeClone();

    var w = segmentWidthPx();
    if (w < 1) return;

    var pxPerSec = manifestoPxPerSecond();
    var durationS = w / pxPerSec;
    track.style.setProperty("--marquee-shift", "-" + w + "px");
    track.style.setProperty("--marquee-duration", durationS + "s");
    track.classList.add("is-marquee-synced");
    hardRestartAnimation();
    lastMode = "marquee";
    lastShiftPx = w;
  }

  function syncLayout() {
    var segmentW = segmentWidthPx();
    var viewportW = viewport.clientWidth;
    if (segmentW < 1 || viewportW < 1) return;

    /* Cabe inteiro na viewport → fila estática centrada, sem repetir logos. */
    if (segmentW <= viewportW) {
      if (lastMode !== "static") setStaticMode();
      return;
    }

    /* Overflow → marquee com exatamente 2 blocos idênticos (loop -50%). */
    setMarqueeMode();
  }

  function scheduleStart() {
    requestAnimationFrame(function () {
      requestAnimationFrame(syncLayout);
    });
  }

  function onResizeDebounced() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var prevMode = lastMode;
      var prevShift = lastShiftPx;
      syncLayout();
      if (lastMode === "marquee" && prevMode === "marquee" && Math.abs(lastShiftPx - prevShift) >= 1) {
        hardRestartAnimation();
      }
    }, 400);
  }

  function onLogoImageLoaded() {
    syncLayout();
  }

  track.querySelectorAll("img").forEach(function (img) {
    if (img.complete) return;
    img.addEventListener("load", onLogoImageLoaded, { once: true });
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleStart);
  } else {
    window.addEventListener("load", scheduleStart, { once: true });
  }

  setTimeout(function () {
    if (lastMode === null) syncLayout();
  }, 2000);

  window.addEventListener("resize", onResizeDebounced, { passive: true });
})();
