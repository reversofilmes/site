/**
 * Home — seção Sobre: reveal ao scroll + CONTRÁRIO (mesmo flip do rodapé).
 */
(function () {
  "use strict";

  function revealCopyBlock(block) {
    block.classList.add("home-sobre__copy--visible");

    var lines = block.querySelectorAll(".home-sobre__line, .home-sobre__cta");
    if (
      lines.length &&
      typeof gsap !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      gsap.fromTo(
        lines,
        { opacity: 0, y: 22 },
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          ease: "power2.out",
          stagger: 0.12,
          clearProps: "transform",
        },
      );
    }
  }

  function initCopyReveal() {
    var blocks = document.querySelectorAll(".home-sobre__copy");
    if (!blocks.length) return;

    if (typeof IntersectionObserver === "undefined") {
      blocks.forEach(revealCopyBlock);
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          revealCopyBlock(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "-6% 0px -10% 0px", threshold: 0.12 },
    );

    blocks.forEach(function (block) {
      observer.observe(block);
    });
  }

  function initSobrePhotoParallax() {
    var block = document.querySelector(".home-sobre");
    var photo = block && block.querySelector(".home-sobre__photo");
    if (!block || !photo) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    /* Cover + min-height no tablet/mobile: parallax expõe fundo preto no rodapé */
    if (window.matchMedia("(max-width: 1024px)").matches) return;

    var ticking = false;
    var maxShiftRatio = 0.12;

    function updateParallax() {
      ticking = false;
      var rect = block.getBoundingClientRect();
      var vh = window.innerHeight || 1;
      var blockHeight = block.offsetHeight || rect.height || 1;

      if (rect.bottom < 0 || rect.top > vh) return;

      var progress = (vh - rect.top) / (vh + blockHeight);
      progress = Math.min(1, Math.max(0, progress));
      var y = (progress - 0.5) * 2 * blockHeight * maxShiftRatio;

      photo.style.transform =
        "scaleX(-1) scale(1.1) translate3d(0, " + y.toFixed(2) + "px, 0)";
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateParallax);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    updateParallax();
  }

  function revealRespiroLines(lines) {
    lines.forEach(function (line) {
      line.classList.add("home-sobre-respiro__line--visible");
    });

    if (
      lines.length &&
      typeof gsap !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      gsap.fromTo(
        lines,
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          ease: "power2.out",
          stagger: 0.14,
          clearProps: "transform",
        },
      );
    }
  }

  function initRespiroReveal() {
    var section = document.querySelector(".home-sobre-respiro");
    if (!section) return;

    var lines = section.querySelectorAll(".home-sobre-respiro__line");
    if (!lines.length) return;

    if (typeof IntersectionObserver === "undefined") {
      revealRespiroLines(lines);
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          revealRespiroLines(lines);
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "-8% 0px -12% 0px", threshold: 0.2 },
    );

    observer.observe(section);
  }

  function initMundoReveal() {
    var section = document.querySelector(".home-sobre-mundo");
    if (!section) return;

    if (typeof IntersectionObserver === "undefined") {
      section.classList.add("home-sobre-mundo--visible");
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("home-sobre-mundo--visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "-8% 0px -10% 0px", threshold: 0.12 },
    );

    observer.observe(section);
  }

  function initSobreContrarioTrigger() {
    var flipTarget = document.querySelector("[data-sobre-contrario]");
    if (!flipTarget || !window.ReversoContrarioFlip) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var link = flipTarget.closest(".home-sobre__cta");
    if (!link) return;

    ReversoContrarioFlip.splitLetters(
      flipTarget,
      ReversoContrarioFlip.FOOTER_LETTER_CLASS,
    );

    function playFlip() {
      if (flipTarget._rvContrarioTl) {
        flipTarget._rvContrarioTl.restart();
        return;
      }
      ReversoContrarioFlip.play(flipTarget, { repeat: 0 });
    }

    var touchMq = window.matchMedia("(max-width: 1024px)");
    var centerObserver = null;

    function onLinkActivate() {
      playFlip();
    }

    function disableDesktop() {
      link.removeEventListener("mouseenter", onLinkActivate);
      link.removeEventListener("focus", onLinkActivate);
    }

    function enableDesktop() {
      link.addEventListener("mouseenter", onLinkActivate);
      link.addEventListener("focus", onLinkActivate);
    }

    function enableTouch() {
      centerObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) playFlip();
          });
        },
        { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
      );
      centerObserver.observe(link);
    }

    function setup() {
      disableDesktop();
      if (centerObserver) {
        centerObserver.disconnect();
        centerObserver = null;
      }
      if (touchMq.matches) enableTouch();
      else enableDesktop();
    }

    setup();
    touchMq.addEventListener("change", setup);
  }

  function init() {
    if (!document.body.classList.contains("is-home")) return;
    initCopyReveal();
    initSobreContrarioTrigger();
    initSobrePhotoParallax();
    initRespiroReveal();
    initMundoReveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
