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

  function initPhotoParallax(block, photoSelector, maxShiftRatio) {
    if (!block) return;

    var photo = block.querySelector(photoSelector);
    if (!photo) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(max-width: 1024px)").matches) return;

    var shiftRatio = maxShiftRatio != null ? maxShiftRatio : 0.05;
    var overscanScale = 1 + shiftRatio * 2 + 0.02;
    var ticking = false;

    function updateParallax() {
      ticking = false;

      if (window.matchMedia("(max-width: 1024px)").matches) {
        photo.style.transform = "";
        return;
      }

      var rect = block.getBoundingClientRect();
      var vh = window.innerHeight || 1;
      var blockHeight = block.offsetHeight || rect.height || 1;

      if (rect.bottom < 0 || rect.top > vh) return;

      var progress = (vh - rect.top) / (vh + blockHeight);
      progress = Math.min(1, Math.max(0, progress));
      var y = (progress - 0.5) * 2 * blockHeight * shiftRatio;

      photo.style.transform =
        "translate3d(0, " +
        y.toFixed(2) +
        "px, 0) scale(" +
        overscanScale.toFixed(3) +
        ")";
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

  function initSobrePhotoParallax() {
    initPhotoParallax(document.querySelector(".home-sobre"), ".home-sobre__photo");
    initPhotoParallax(
      document.querySelector(".home-sobre-perspectivas"),
      ".home-sobre-perspectivas__photo",
    );
    initPhotoParallax(
      document.querySelector(".home-sobre-curupire"),
      ".home-sobre-curupire__photo",
    );
  }

  function initMundoCardImagePan() {
    var section = document.querySelector(".home-sobre-mundo");
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var maxShift = 8;
    var ease = 0.14;

    section.querySelectorAll(".home-sobre-mundo__item").forEach(function (item) {
      var media = item.querySelector(".home-sobre-mundo__media");
      var img = media && media.querySelector("img");
      if (!media || !img) return;

      var active = false;
      var currentX = 0;
      var currentY = 0;
      var targetX = 0;
      var targetY = 0;
      var rafId = null;

      function applyTransform() {
        if (
          !active &&
          Math.abs(currentX) < 0.05 &&
          Math.abs(currentY) < 0.05
        ) {
          currentX = 0;
          currentY = 0;
          img.style.transform = "";
          media.classList.remove("is-panning");
          return;
        }

        img.style.transform =
          "translate3d(" +
          currentX.toFixed(2) +
          "px, " +
          currentY.toFixed(2) +
          "px, 0) scale(1.08)";
      }

      function tick() {
        currentX += (targetX - currentX) * ease;
        currentY += (targetY - currentY) * ease;
        applyTransform();

        var moving =
          active ||
          Math.abs(targetX - currentX) > 0.05 ||
          Math.abs(targetY - currentY) > 0.05 ||
          Math.abs(currentX) > 0.05 ||
          Math.abs(currentY) > 0.05;

        if (moving) {
          rafId = requestAnimationFrame(tick);
        } else {
          rafId = null;
        }
      }

      function ensureTick() {
        if (!rafId) rafId = requestAnimationFrame(tick);
      }

      function setTarget(clientX, clientY) {
        var rect = media.getBoundingClientRect();
        var px = (clientX - rect.left) / rect.width;
        var py = (clientY - rect.top) / rect.height;
        px = Math.min(1, Math.max(0, px));
        py = Math.min(1, Math.max(0, py));
        var dx = (px - 0.5) * 2;
        var dy = (py - 0.5) * 2;

        targetX = dx * maxShift;
        targetY = dy * maxShift;
        ensureTick();
      }

      function resetPan() {
        active = false;
        targetX = 0;
        targetY = 0;
        ensureTick();
      }

      function onPointerEnter(event) {
        if (event.pointerType === "touch") return;
        active = true;
        media.classList.add("is-panning");
      }

      function onPointerMove(event) {
        if (!active) return;
        setTarget(event.clientX, event.clientY);
      }

      function onPointerLeave(event) {
        if (event.pointerType === "touch") return;
        resetPan();
      }

      media.addEventListener("pointerenter", onPointerEnter);
      media.addEventListener("pointermove", onPointerMove);
      media.addEventListener("pointerleave", onPointerLeave);
      media.addEventListener("pointercancel", resetPan);
    });
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

  function revealPerspectivasLines(lines) {
    lines.forEach(function (line) {
      line.classList.add("home-sobre-perspectivas__line--visible");
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
          stagger: 0.12,
          clearProps: "transform",
        },
      );
    }
  }

  function initPerspectivasReveal() {
    var section = document.querySelector(".home-sobre-perspectivas");
    if (!section) return;

    var lines = section.querySelectorAll(".home-sobre-perspectivas__line");
    if (!lines.length) return;

    if (typeof IntersectionObserver === "undefined") {
      revealPerspectivasLines(lines);
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          revealPerspectivasLines(lines);
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "-8% 0px -12% 0px", threshold: 0.2 },
    );

    observer.observe(section);
  }

  function resetContrarioFlip(flipTarget) {
    if (!flipTarget || !window.ReversoContrarioFlip) return;

    var letterClass = ReversoContrarioFlip.FOOTER_LETTER_CLASS;
    var outlineClass = ReversoContrarioFlip.FOOTER_OUTLINE_CLASS;

    if (flipTarget._rvContrarioTl) {
      flipTarget._rvContrarioTl.kill();
      flipTarget._rvContrarioTl = null;
    }

    flipTarget.classList.remove(outlineClass);

    if (typeof gsap !== "undefined") {
      gsap.set(flipTarget, { opacity: 1 });
      var letters = flipTarget.querySelectorAll("." + letterClass);
      if (letters.length) {
        gsap.set(letters, { rotationX: 0, clearProps: "transform" });
      }
    }
  }

  function startContrarioLoop(flipTarget) {
    if (!flipTarget || !window.ReversoContrarioFlip) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    resetContrarioFlip(flipTarget);
    ReversoContrarioFlip.play(flipTarget, { repeat: -1, repeatDelay: 2 });
  }

  function resetAllServicoItems(items) {
    items.forEach(function (item) {
      item.classList.remove("is-active");
      resetContrarioFlip(item.querySelector("[data-servico-flip]"));
    });
  }

  function isServicoVideoUrl(url) {
    return /\.(mp4|webm)(\?|$)/i.test(String(url || "").trim());
  }

  function setServicoMedia(section, gifUrl, isActive) {
    var media = section.querySelector(".home-sobre-servicos__media");
    var gif = section.querySelector(".home-sobre-servicos__gif");
    var video = section.querySelector(".home-sobre-servicos__video");
    if (!media || !gif) return;

    function hideMedia() {
      gif.hidden = true;
      gif.removeAttribute("src");
      if (video) {
        video.hidden = true;
        video.removeAttribute("src");
        video.load();
      }
    }

    if (!isActive) {
      media.classList.remove("is-active");
      media.setAttribute("aria-hidden", "true");
      hideMedia();
      return;
    }

    media.classList.add("is-active");
    media.setAttribute("aria-hidden", "false");

    var url = (gifUrl || "").trim();
    if (!url) {
      hideMedia();
      return;
    }

    var busted = url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
    if (isServicoVideoUrl(url)) {
      gif.hidden = true;
      gif.removeAttribute("src");
      if (video) {
        video.hidden = false;
        video.src = busted;
        video.load();
      }
      return;
    }

    if (video) {
      video.hidden = true;
      video.removeAttribute("src");
      video.load();
    }
    gif.hidden = false;
    gif.src = busted;
  }

  function initHomeServicos() {
    var section = document.querySelector(".home-sobre-servicos");
    if (!section) return;

    var items = section.querySelectorAll(".home-sobre-servicos__item");
    if (!items.length) return;

    var touchMq = window.matchMedia("(max-width: 1024px)");
    var activeItem = null;
    var itemHandlers = [];

    function clearActive() {
      resetAllServicoItems(items);
      activeItem = null;
      setServicoMedia(section, "", false);
    }

    function activateItem(item) {
      var trigger = item.querySelector(".home-sobre-servicos__trigger");
      var flipTarget = item.querySelector("[data-servico-flip]");
      if (!trigger || !flipTarget) return;

      if (activeItem === item) return;

      resetAllServicoItems(items);

      activeItem = item;
      item.classList.add("is-active");
      startContrarioLoop(flipTarget);
      setServicoMedia(section, trigger.getAttribute("data-servico-gif") || "", true);
    }

    function bindItem(item) {
      var trigger = item.querySelector(".home-sobre-servicos__trigger");
      var flipTarget = item.querySelector("[data-servico-flip]");
      if (!trigger || !flipTarget) return null;

      if (window.ReversoContrarioFlip) {
        ReversoContrarioFlip.splitLetters(
          flipTarget,
          ReversoContrarioFlip.FOOTER_LETTER_CLASS,
        );
      }

      return {
        item: item,
        trigger: trigger,
        onEnter: function () {
          activateItem(item);
        },
        onLeave: function () {
          if (touchMq.matches) return;
          if (activeItem !== item) return;
          clearActive();
        },
        onClick: function (event) {
          event.preventDefault();
          if (item.classList.contains("is-active")) {
            clearActive();
            return;
          }
          activateItem(item);
        },
      };
    }

    function unbindAll() {
      itemHandlers.forEach(function (handlers) {
        if (!handlers) return;
        handlers.trigger.removeEventListener("mouseenter", handlers.onEnter);
        handlers.trigger.removeEventListener("mouseleave", handlers.onLeave);
        handlers.trigger.removeEventListener("focus", handlers.onEnter);
        handlers.trigger.removeEventListener("blur", handlers.onLeave);
        handlers.trigger.removeEventListener("click", handlers.onClick);
      });
      itemHandlers = [];
    }

    function setup() {
      unbindAll();
      clearActive();

      items.forEach(function (item) {
        var handlers = bindItem(item);
        if (!handlers) return;

        itemHandlers.push(handlers);

        if (touchMq.matches) {
          handlers.trigger.addEventListener("click", handlers.onClick);
        } else {
          handlers.trigger.addEventListener("mouseenter", handlers.onEnter);
          handlers.trigger.addEventListener("mouseleave", handlers.onLeave);
          handlers.trigger.addEventListener("focus", handlers.onEnter);
          handlers.trigger.addEventListener("blur", handlers.onLeave);
        }
      });
    }

    setup();
    touchMq.addEventListener("change", setup);
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

    var touchMq = window.matchMedia("(max-width: 1024px)");
    var centerObserver = null;

    function onLinkActivate() {
      startContrarioLoop(flipTarget);
    }

    function onLinkDeactivate() {
      resetContrarioFlip(flipTarget);
    }

    function disableDesktop() {
      link.removeEventListener("mouseenter", onLinkActivate);
      link.removeEventListener("mouseleave", onLinkDeactivate);
      link.removeEventListener("focus", onLinkActivate);
      link.removeEventListener("blur", onLinkDeactivate);
    }

    function enableDesktop() {
      link.addEventListener("mouseenter", onLinkActivate);
      link.addEventListener("mouseleave", onLinkDeactivate);
      link.addEventListener("focus", onLinkActivate);
      link.addEventListener("blur", onLinkDeactivate);
    }

    function enableTouch() {
      centerObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) onLinkActivate();
            else onLinkDeactivate();
          });
        },
        { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
      );
      centerObserver.observe(link);
    }

    function setup() {
      disableDesktop();
      onLinkDeactivate();
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

  function initEquipeReveal() {
    var section = document.querySelector(".home-sobre-equipe");
    if (!section) return;

    var items = section.querySelectorAll(".home-sobre-equipe__item");
    if (!items.length) return;

    function revealEquipe() {
      if (section.classList.contains("home-sobre-equipe--revealed")) return;

      var reduceMotion = false;
      try {
        reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch (_) {}

      var stagger = reduceMotion ? 0 : 0.1;
      items.forEach(function (item, index) {
        item.style.setProperty("--equipe-reveal-delay", index * stagger + "s");
      });
      section.classList.add("home-sobre-equipe--revealed");
    }

    if (typeof IntersectionObserver === "undefined") {
      revealEquipe();
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          revealEquipe();
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "-8% 0px -12% 0px", threshold: 0.15 },
    );

    observer.observe(section);
  }

  function initHomeEquipeCarousel() {
    var section = document.querySelector(".home-sobre-equipe--carousel");
    if (!section) return;

    var grid = section.querySelector(".home-sobre-equipe__grid");
    var prev = section.querySelector(".home-sobre-equipe__nav--prev");
    var next = section.querySelector(".home-sobre-equipe__nav--next");
    if (!grid || !prev || !next) return;

    prev.hidden = false;
    next.hidden = false;

    function scrollStep(direction) {
      var item = grid.querySelector(".home-sobre-equipe__item");
      if (!item) return;
      var gap = parseFloat(getComputedStyle(grid).columnGap || getComputedStyle(grid).gap || "0") || 0;
      var step = (item.offsetWidth + gap) * 2;
      grid.scrollBy({ left: direction * step, behavior: "smooth" });
    }

    function updateNav() {
      var maxScroll = grid.scrollWidth - grid.clientWidth;
      prev.disabled = grid.scrollLeft <= 2;
      next.disabled = grid.scrollLeft >= maxScroll - 2;
    }

    prev.addEventListener("click", function () {
      scrollStep(-1);
    });
    next.addEventListener("click", function () {
      scrollStep(1);
    });
    grid.addEventListener("scroll", updateNav, { passive: true });
    window.addEventListener("resize", updateNav);
    updateNav();
  }

  function initHomeEquipe() {
    var section = document.querySelector(".home-sobre-equipe");
    if (!section) return;

    var cards = section.querySelectorAll(".home-sobre-equipe__card");
    if (!cards.length) return;

    var touchMq = window.matchMedia("(max-width: 1024px), (hover: none)");
    var cardHandlers = [];

    function clearActiveCards() {
      cards.forEach(function (card) {
        card.classList.remove("is-active");
      });
    }

    function getInstagramUrl(card) {
      var url = card.getAttribute("data-instagram-url");
      return url && url.trim() ? url.trim() : null;
    }

    function openInstagram(url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }

    function unbindCards() {
      cardHandlers.forEach(function (entry) {
        entry.card.removeEventListener("click", entry.onClick);
        if (entry.onKeyDown) entry.card.removeEventListener("keydown", entry.onKeyDown);
      });
      cardHandlers = [];
      clearActiveCards();
    }

    function bindCards() {
      unbindCards();

      cards.forEach(function (card) {
        var igUrl = getInstagramUrl(card);

        function onClick(event) {
          if (touchMq.matches) {
            event.preventDefault();
            var isActive = card.classList.contains("is-active");
            if (isActive && igUrl) {
              openInstagram(igUrl);
              return;
            }
            clearActiveCards();
            if (!isActive) card.classList.add("is-active");
            return;
          }

          if (igUrl) {
            event.preventDefault();
            openInstagram(igUrl);
          }
        }

        function onKeyDown(event) {
          if (event.key !== "Enter" && event.key !== " ") return;
          if (!igUrl || touchMq.matches) return;
          event.preventDefault();
          openInstagram(igUrl);
        }

        if (touchMq.matches || igUrl) {
          card.addEventListener("click", onClick);
          var entry = { card: card, onClick: onClick };
          if (igUrl && !touchMq.matches) {
            card.addEventListener("keydown", onKeyDown);
            entry.onKeyDown = onKeyDown;
          }
          cardHandlers.push(entry);
        }
      });
    }

    bindCards();
    touchMq.addEventListener("change", bindCards);
  }

  function init() {
    if (!document.body.classList.contains("is-home")) return;
    initCopyReveal();
    initSobreContrarioTrigger();
    initSobrePhotoParallax();
    initRespiroReveal();
    initMundoReveal();
    initMundoCardImagePan();
    initPerspectivasReveal();
    initHomeServicos();
    initEquipeReveal();
    initHomeEquipe();
    initHomeEquipeCarousel();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
