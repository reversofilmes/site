/**
 * Home — navegação por âncoras (#sobre, etc.) com scroll suave.
 */
(function () {
  "use strict";

  function scrollToHash(hash, behavior) {
    if (!hash || hash === "#") return;
    var target = document.querySelector(hash);
    if (!target) return;
    target.scrollIntoView({ behavior: behavior || "smooth", block: "start" });
  }

  function init() {
    if (!document.body.classList.contains("is-home")) return;

    var reduceMotion = false;
    try {
      reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (_) {}

    document.addEventListener("click", function (e) {
      var link = e.target.closest('a[href*="#"]');
      if (!link) return;

      var url;
      try {
        url = new URL(link.href, window.location.href);
      } catch (_) {
        return;
      }

      if (url.pathname.replace(/\/$/, "") !== window.location.pathname.replace(/\/$/, "")) {
        return;
      }

      if (!url.hash) return;

      var target = document.querySelector(url.hash);
      if (!target) return;

      e.preventDefault();
      scrollToHash(url.hash, reduceMotion ? "auto" : "smooth");

      if (history.replaceState) {
        history.replaceState(null, "", url.hash);
      }
    });

    if (window.location.hash) {
      var hash = window.location.hash;
      var behavior = reduceMotion ? "auto" : "smooth";
      function go() {
        scrollToHash(hash, behavior);
      }
      if (document.readyState === "complete") {
        setTimeout(go, 120);
      } else {
        window.addEventListener("load", function () {
          setTimeout(go, 120);
        }, { once: true });
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
