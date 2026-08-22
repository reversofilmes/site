/**
 * Home — seção Sobre: reveal bidirecional ao scroll + CONTRÁRIO (mesmo flip do rodapé).
 */
(function () {
  "use strict";

  /* Faixa central da viewport: dispara mais tarde (menos “canto inferior”). */
  var SCROLL_REVEAL_MARGIN = "-18% 0px -32% 0px";
  var SCROLL_REVEAL_THRESHOLD = 0;

  function prefersReducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (_) {
      return false;
    }
  }

  function initScrollReveal(targets, options) {
    if (!targets || !targets.length) return;

    var showClass = options.showClass;
    var rootMargin = options.rootMargin || SCROLL_REVEAL_MARGIN;
    var threshold =
      options.threshold != null ? options.threshold : SCROLL_REVEAL_THRESHOLD;

    function setVisible(el, visible) {
      el.classList.toggle(showClass, visible);
    }

    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      targets.forEach(function (el) {
        setVisible(el, true);
      });
      return function noop() {};
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          setVisible(entry.target, entry.isIntersecting);
        });
      },
      { rootMargin: rootMargin, threshold: threshold },
    );

    targets.forEach(function (el) {
      observer.observe(el);
    });

    return function disconnect() {
      observer.disconnect();
    };
  }

  function initCopyReveal() {
    var blocks = document.querySelectorAll(".home-sobre__copy");
    initScrollReveal(blocks, { showClass: "home-sobre__copy--visible" });
  }

  function initPhotoParallax(block, photoSelector, maxShiftRatio) {
    if (!block) return;

    var photo = block.querySelector(photoSelector);
    if (!photo) return;

    var mobileMq = window.matchMedia("(max-width: 1024px)");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var shiftRatio = maxShiftRatio != null ? maxShiftRatio : 0.05;
    var overscanScale = 1 + shiftRatio * 2 + 0.02;
    var ticking = false;

    function clearParallax() {
      photo.style.transform = "";
    }

    function updateParallax() {
      ticking = false;

      if (mobileMq.matches) {
        clearParallax();
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

    function onBreakpointChange() {
      clearParallax();
      if (!mobileMq.matches) updateParallax();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    mobileMq.addEventListener("change", onBreakpointChange);
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

  function initMundoCardVideoPreview() {
    var section = document.querySelector(".home-sobre-mundo");
    if (!section) return;
    if (prefersReducedMotion()) return;

    var items = section.querySelectorAll(".home-sobre-mundo__item");
    var videoMap = new Map();
    var observer = null;
    var hoverHandlers = new WeakMap();
    var previewScrollMq = window.matchMedia("(max-width: 1024px)");

    items.forEach(function (item) {
      var videoEl = item.querySelector(".home-sobre-mundo__video");
      if (!videoEl) return;
      videoMap.set(item, { videoEl: videoEl, state: { loaded: false, loading: false } });
    });

    if (!videoMap.size) return;

    function isScrollPreview() {
      return previewScrollMq.matches;
    }

    function setInView(item, active) {
      item.classList.toggle("is-preview-playing", active);
    }

    function loadVideo(videoEl, state) {
      if (state.loaded || state.loading) return;
      var sourceEl = videoEl.querySelector("source");
      if (!(sourceEl && sourceEl.src) && !videoEl.currentSrc) return;
      state.loading = true;

      if (videoEl.readyState >= 2) {
        state.loaded = true;
        state.loading = false;
        return;
      }

      videoEl.addEventListener(
        "canplay",
        function () {
          state.loaded = true;
          state.loading = false;
        },
        { once: true },
      );
      videoEl.addEventListener(
        "error",
        function () {
          state.loading = false;
        },
        { once: true },
      );

      try {
        videoEl.load();
      } catch (_) {
        state.loading = false;
      }
    }

    function tryPlay(videoEl) {
      var p = videoEl.play();
      if (p !== undefined) {
        p.then(function () {
          videoEl.classList.add("playing");
        }).catch(function () {});
      }
    }

    function playVideo(videoEl, state) {
      if (!state.loaded && !state.loading) loadVideo(videoEl, state);

      if (videoEl.readyState < 2 && !state.loaded) {
        videoEl.addEventListener(
          "canplay",
          function () {
            tryPlay(videoEl);
          },
          { once: true },
        );
        return;
      }
      tryPlay(videoEl);
    }

    function hideVideo(videoEl) {
      videoEl.pause();
      videoEl.currentTime = 0;
      videoEl.classList.remove("playing");
    }

    function resetAllPreviews() {
      videoMap.forEach(function (data, item) {
        setInView(item, false);
        hideVideo(data.videoEl);
      });
    }

    function onMobileIntersection(entries) {
      entries.forEach(function (entry) {
        var item = entry.target;
        var data = videoMap.get(item);
        if (!data) return;

        if (entry.isIntersecting) {
          setInView(item, true);
          playVideo(data.videoEl, data.state);
        } else {
          setInView(item, false);
          hideVideo(data.videoEl);
        }
      });
    }

    function onPreloadIntersection(entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var data = videoMap.get(entry.target);
        if (data) {
          loadVideo(data.videoEl, data.state);
          observer.unobserve(entry.target);
        }
      });
    }

    function bindDesktopHover() {
      videoMap.forEach(function (data, item) {
        if (hoverHandlers.has(item)) return;

        var handlers = {
          enter: function () {
            playVideo(data.videoEl, data.state);
          },
          leave: function () {
            hideVideo(data.videoEl);
          },
          focus: function () {
            playVideo(data.videoEl, data.state);
          },
          blur: function () {
            hideVideo(data.videoEl);
          },
        };
        hoverHandlers.set(item, handlers);
        item.addEventListener("mouseenter", handlers.enter);
        item.addEventListener("mouseleave", handlers.leave);
        item.addEventListener("focus", handlers.focus);
        item.addEventListener("blur", handlers.blur);
      });
    }

    function unbindDesktopHover() {
      videoMap.forEach(function (_data, item) {
        var handlers = hoverHandlers.get(item);
        if (!handlers) return;
        item.removeEventListener("mouseenter", handlers.enter);
        item.removeEventListener("mouseleave", handlers.leave);
        item.removeEventListener("focus", handlers.focus);
        item.removeEventListener("blur", handlers.blur);
        hoverHandlers.delete(item);
      });
    }

    function setupPreviewMode() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }

      if (isScrollPreview()) {
        unbindDesktopHover();
        observer = new IntersectionObserver(onMobileIntersection, {
          rootMargin: "-45% 0px -45% 0px",
          threshold: 0,
        });
        videoMap.forEach(function (_data, item) {
          observer.observe(item);
        });
      } else {
        resetAllPreviews();
        bindDesktopHover();
        observer = new IntersectionObserver(onPreloadIntersection, {
          rootMargin: "200px",
        });
        videoMap.forEach(function (data, item) {
          observer.observe(item);
        });
      }
    }

    setupPreviewMode();
    previewScrollMq.addEventListener("change", setupPreviewMode);
  }

  function initRespiroReveal() {
    var copy = document.querySelector(".home-sobre-respiro__copy");
    if (!copy) return;
    initScrollReveal([copy], { showClass: "home-sobre-respiro__copy--visible" });
  }

  function initMundoReveal() {
    var section = document.querySelector(".home-sobre-mundo");
    if (!section) return;

    var head = section.querySelector(".home-sobre-mundo__head");
    var grid = section.querySelector(".home-sobre-mundo__grid");
    var items = section.querySelectorAll(".home-sobre-mundo__item");
    if (!head || !grid || !items.length) return;

    var mobileMq = window.matchMedia("(max-width: 560px)");
    var disconnectFns = [];

    function teardown() {
      disconnectFns.forEach(function (fn) {
        if (fn) fn();
      });
      disconnectFns = [];
      head.classList.remove("home-sobre-mundo__head--visible");
      grid.classList.remove("home-sobre-mundo__grid--visible");
      items.forEach(function (item) {
        item.classList.remove("home-sobre-mundo__item--visible");
      });
    }

    function setup() {
      teardown();

      var headDisconnect = initScrollReveal([head], {
        showClass: "home-sobre-mundo__head--visible",
      });
      if (headDisconnect) disconnectFns.push(headDisconnect);

      if (mobileMq.matches) {
        var itemsDisconnect = initScrollReveal(items, {
          showClass: "home-sobre-mundo__item--visible",
        });
        if (itemsDisconnect) disconnectFns.push(itemsDisconnect);
      } else {
        var gridDisconnect = initScrollReveal([grid], {
          showClass: "home-sobre-mundo__grid--visible",
        });
        if (gridDisconnect) disconnectFns.push(gridDisconnect);
      }
    }

    setup();
    mobileMq.addEventListener("change", setup);
  }

  function initPerspectivasReveal() {
    var copy = document.querySelector(".home-sobre-perspectivas__copy");
    if (!copy) return;
    initScrollReveal([copy], { showClass: "home-sobre-perspectivas__copy--visible" });
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

  function startContrarioLoop(flipTarget, timingOverrides) {
    if (!flipTarget || !window.ReversoContrarioFlip) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    resetContrarioFlip(flipTarget);
    ReversoContrarioFlip.play(
      flipTarget,
      Object.assign({ repeat: -1, repeatDelay: 2 }, timingOverrides || {}),
    );
  }

  var SERVICO_FLIP_TIMINGS = {
    outlineHold: 0.08,
    flipDuration: 0.09,
    flipStagger: 0.035,
    unflipDuration: 0.09,
    unflipStagger: 0.012,
  };

  function startContrarioFlipIn(flipTarget) {
    if (!flipTarget || !window.ReversoContrarioFlip) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    resetContrarioFlip(flipTarget);
    ReversoContrarioFlip.flipIn(flipTarget, SERVICO_FLIP_TIMINGS);
  }

  function stopContrarioFlip(flipTarget, animated) {
    if (!flipTarget || !window.ReversoContrarioFlip) return;

    if (
      animated &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      ReversoContrarioFlip.flipOut(flipTarget, SERVICO_FLIP_TIMINGS);
      return;
    }

    resetContrarioFlip(flipTarget);
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

    function clearActive(animateFlipOut) {
      if (activeItem) {
        var leavingFlip = activeItem.querySelector("[data-servico-flip]");
        activeItem.classList.remove("is-active");
        stopContrarioFlip(leavingFlip, !!animateFlipOut);
      }

      items.forEach(function (item) {
        if (item === activeItem) return;
        resetContrarioFlip(item.querySelector("[data-servico-flip]"));
      });

      activeItem = null;
      setServicoMedia(section, "", false);
    }

    function activateItem(item) {
      var trigger = item.querySelector(".home-sobre-servicos__trigger");
      var flipTarget = item.querySelector("[data-servico-flip]");
      if (!trigger || !flipTarget) return;

      if (activeItem === item) return;

      items.forEach(function (entry) {
        if (entry === item) return;
        entry.classList.remove("is-active");
        resetContrarioFlip(entry.querySelector("[data-servico-flip]"));
      });

      activeItem = item;
      item.classList.add("is-active");
      startContrarioFlipIn(flipTarget);
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
          clearActive(true);
        },
        onClick: function (event) {
          event.preventDefault();
          if (item.classList.contains("is-active")) {
            clearActive(true);
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

  function initContrarioHoverLink(link, flipTarget) {
    if (!link || !flipTarget || !window.ReversoContrarioFlip) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var touchMq = window.matchMedia("(max-width: 1024px)");

    ReversoContrarioFlip.splitLetters(
      flipTarget,
      ReversoContrarioFlip.FOOTER_LETTER_CLASS,
    );

    function activateFlip() {
      startContrarioLoop(flipTarget, { repeatDelay: 0, unflipHold: 0 });
    }

    function deactivateFlip() {
      resetContrarioFlip(flipTarget);
    }

    function disarm() {
      link.classList.remove("is-armed");
      deactivateFlip();
    }

    function onDesktopEnter() {
      activateFlip();
    }

    function onDesktopLeave() {
      deactivateFlip();
    }

    function onTouchClick(event) {
      if (!touchMq.matches) return;
      if (link.classList.contains("is-armed")) return;
      event.preventDefault();
      link.classList.add("is-armed");
      activateFlip();
    }

    function onFocusIn() {
      if (touchMq.matches) return;
      activateFlip();
    }

    function onFocusOut() {
      if (touchMq.matches) return;
      deactivateFlip();
    }

    function bindDesktop() {
      link.addEventListener("mouseenter", onDesktopEnter);
      link.addEventListener("mouseleave", onDesktopLeave);
      link.addEventListener("focusin", onFocusIn);
      link.addEventListener("focusout", onFocusOut);
      link.removeEventListener("click", onTouchClick);
    }

    function bindTouch() {
      link.removeEventListener("mouseenter", onDesktopEnter);
      link.removeEventListener("mouseleave", onDesktopLeave);
      link.removeEventListener("focusin", onFocusIn);
      link.removeEventListener("focusout", onFocusOut);
      link.addEventListener("click", onTouchClick);
    }

    function setupMode() {
      disarm();
      if (touchMq.matches) bindTouch();
      else bindDesktop();
    }

    setupMode();
    touchMq.addEventListener("change", setupMode);
  }

  function initSobreCta() {
    initContrarioHoverLink(
      document.querySelector(".home-sobre__cta"),
      document.querySelector("[data-sobre-contrario]"),
    );
  }

  function initCurupireCta() {
    initContrarioHoverLink(
      document.querySelector(".home-sobre-curupire__title"),
      document.querySelector("[data-curupire-contrario]"),
    );
  }

  function downscaleEquipeImg(img, maxEdge) {
    return new Promise(function (resolve) {
      if (!img || img.dataset.resized === "1") {
        resolve();
        return;
      }
      var nw = img.naturalWidth || 0;
      var nh = img.naturalHeight || 0;
      if (!nw || (nw <= maxEdge && nh <= maxEdge)) {
        img.dataset.resized = "1";
        resolve();
        return;
      }
      if (typeof createImageBitmap !== "function") {
        resolve();
        return;
      }
      var rw = nw >= nh ? maxEdge : Math.max(1, Math.round(nw * (maxEdge / nh)));
      var rh = nh > nw ? maxEdge : Math.max(1, Math.round(nh * (maxEdge / nw)));
      createImageBitmap(img, {
        resizeWidth: rw,
        resizeHeight: rh,
        resizeQuality: "high",
      })
        .then(function (bmp) {
          var canvas = document.createElement("canvas");
          canvas.width = bmp.width;
          canvas.height = bmp.height;
          var ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) {
            bmp.close();
            resolve();
            return;
          }
          ctx.drawImage(bmp, 0, 0);
          bmp.close();
          canvas.toBlob(
            function (blob) {
              if (!blob) {
                resolve();
                return;
              }
              img.dataset.resized = "1";
              img.src = URL.createObjectURL(blob);
              resolve();
            },
            "image/jpeg",
            0.8,
          );
        })
        .catch(function () {
          resolve();
        });
    });
  }

  function loadEquipeImg(img) {
    return new Promise(function (resolve) {
      var src = img.getAttribute("data-equipe-src");
      if (!src || img.getAttribute("src")) {
        resolve(img);
        return;
      }
      var done = function () {
        img.removeEventListener("load", done);
        img.removeEventListener("error", done);
        resolve(img);
      };
      img.addEventListener("load", done);
      img.addEventListener("error", done);
      img.src = src;
    });
  }

  function initEquipePhotos() {
    var section = document.querySelector(".home-sobre-equipe");
    if (!section) return;
    var images = Array.prototype.slice.call(
      section.querySelectorAll("img[data-equipe-src]"),
    );
    if (!images.length) return;

    var started = false;
    var MAX_EDGE = 720;

    function startQueue() {
      if (started) return;
      started = true;
      var chain = Promise.resolve();
      images.forEach(function (img) {
        chain = chain
          .then(function () {
            return loadEquipeImg(img);
          })
          .then(function (loaded) {
            return downscaleEquipeImg(loaded, MAX_EDGE);
          });
      });
    }

    if (typeof IntersectionObserver === "undefined") {
      startQueue();
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
        observer.disconnect();
        startQueue();
      },
      { rootMargin: "80% 0px", threshold: 0 },
    );
    observer.observe(section);
  }

  function initEquipeReveal() {
    var section = document.querySelector(".home-sobre-equipe");
    if (!section) return;

    var head = section.querySelector(".home-sobre-equipe__head");
    var items = section.querySelectorAll(".home-sobre-equipe__item");

    if (items.length && !prefersReducedMotion()) {
      items.forEach(function (item, index) {
        item.style.setProperty("--equipe-reveal-delay", index * 0.1 + "s");
      });
    }

    function setEquipeVisible(visible) {
      section.classList.toggle("home-sobre-equipe--revealed", visible);
      if (head) {
        head.classList.toggle("home-sobre-equipe__head--visible", visible);
      }
    }

    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setEquipeVisible(true);
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          setEquipeVisible(entry.isIntersecting);
        });
      },
      { rootMargin: SCROLL_REVEAL_MARGIN, threshold: SCROLL_REVEAL_THRESHOLD },
    );

    observer.observe(section);
  }

  function initHomeEquipeCarousel() {
    var section = document.querySelector(".home-sobre-equipe");
    if (!section) return;

    var grid = section.querySelector(".home-sobre-equipe__grid");
    var prev = section.querySelector(".home-sobre-equipe__nav--prev");
    var next = section.querySelector(".home-sobre-equipe__nav--next");
    if (!grid || !prev || !next) return;

    var items = grid.querySelectorAll(".home-sobre-equipe__item");
    section.style.setProperty("--equipe-count", String(items.length || 1));

    var hasOverflow = null;
    var measuring = false;

    function visibleSlots() {
      if (window.matchMedia("(max-width: 768px)").matches) return 2;
      if (window.matchMedia("(max-width: 1024px)").matches) return 3;
      return 5;
    }

    function scrollStep(direction) {
      var gap = parseFloat(getComputedStyle(grid).columnGap || getComputedStyle(grid).gap || "0") || 0;
      var item = grid.querySelector(".home-sobre-equipe__item");
      if (!item) return;
      var step = Math.max(item.offsetWidth + gap, grid.clientWidth * 0.72);
      grid.scrollBy({ left: direction * step, behavior: "smooth" });
    }

    function updateNavState() {
      if (!hasOverflow) {
        prev.classList.add("home-sobre-equipe__nav--inactive");
        next.classList.add("home-sobre-equipe__nav--inactive");
        return;
      }

      var maxScroll = Math.max(0, grid.scrollWidth - grid.clientWidth);
      prev.classList.toggle("home-sobre-equipe__nav--inactive", grid.scrollLeft <= 1);
      next.classList.toggle("home-sobre-equipe__nav--inactive", grid.scrollLeft >= maxScroll - 1);
    }

    function measureOverflow() {
      if (measuring) return;
      measuring = true;
      var overflow = items.length > visibleSlots();
      if (overflow !== hasOverflow) {
        hasOverflow = overflow;
        section.classList.toggle("home-sobre-equipe--carousel", overflow);
        section.classList.toggle("home-sobre-equipe--fits", !overflow);
        if (!overflow) grid.scrollLeft = 0;
      }
      updateNavState();
      measuring = false;
    }

    prev.addEventListener("click", function () {
      scrollStep(-1);
    });
    next.addEventListener("click", function () {
      scrollStep(1);
    });
    grid.addEventListener("scroll", updateNavState, { passive: true });

    window.addEventListener("resize", measureOverflow);
    measureOverflow();
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
    initSobreCta();
    initCurupireCta();
    initSobrePhotoParallax();
    initRespiroReveal();
    initMundoReveal();
    initMundoCardImagePan();
    initMundoCardVideoPreview();
    initPerspectivasReveal();
    initHomeServicos();
    initEquipePhotos();
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
