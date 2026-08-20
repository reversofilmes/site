/**
 * Flip GSAP de "CONTRÁRIO" — mesma sequência da intro e do ticker do rodapé.
 */
(function () {
  "use strict";

  var FOOTER_LETTER_CLASS = "site-footer__marquee-letter";
  var FOOTER_OUTLINE_CLASS = "site-footer__marquee-contrario-outline";

  var FOOTER_TIMINGS = {
    blinkDuration: 0.1,
    outlineHold: 0.22,
    flipDuration: 0.2,
    flipStagger: 0.13,
    unflipDelay: 0.1,
    unflipHold: 0.32,
    unflipDuration: 0.22,
    unflipStagger: 0.022,
  };

  function splitLetters(root, letterClass) {
    if (!root || root.querySelector("." + letterClass)) return;
    var text = root.textContent.trim();
    root.textContent = "";
    root.setAttribute("aria-label", text);
    for (var i = 0; i < text.length; i++) {
      var span = document.createElement("span");
      span.className = letterClass;
      if (text[i] === " ") {
        span.classList.add(letterClass + "-space");
        span.textContent = "\u00a0";
      } else {
        span.textContent = text[i];
      }
      span.setAttribute("aria-hidden", "true");
      root.appendChild(span);
    }
  }

  function buildTimeline(wrapper, letters, opts) {
    gsap.set(wrapper, { opacity: 1 });
    gsap.set(letters, {
      rotationX: 0,
      transformOrigin: "center center",
      force3D: true,
    });

    var tl = gsap.timeline({
      repeat: opts.repeat,
      repeatDelay: opts.repeatDelay,
      onRepeat: opts.onRepeat,
      onComplete: opts.onComplete,
    });

    if (!opts.skipBlink) {
      tl.to(wrapper, { opacity: 0, duration: opts.blinkDuration, ease: "power2.inOut" })
        .to(wrapper, { opacity: 1, duration: opts.blinkDuration, ease: "power2.inOut" })
        .to(wrapper, { opacity: 0, duration: opts.blinkDuration, ease: "power2.inOut" })
        .to(wrapper, { opacity: 1, duration: opts.blinkDuration, ease: "power2.inOut" });
    }

    tl.to(wrapper, {
        duration: opts.outlineHold,
        ease: "power2.inOut",
        onStart: function () {
          wrapper.classList.add(opts.outlineClass);
        },
      })
      .to(letters, {
        rotationX: 180,
        duration: opts.flipDuration,
        ease: "power2.inOut",
        stagger: opts.flipStagger,
      });

    if (!opts.holdInverted) {
      tl.to(
        wrapper,
        {
          duration: opts.unflipHold,
          ease: "power2.inOut",
          onStart: function () {
            wrapper.classList.remove(opts.outlineClass);
          },
        },
        "+=" + opts.unflipDelay,
      ).to(
        letters,
        {
          rotationX: 0,
          duration: opts.unflipDuration,
          ease: "power2.inOut",
          stagger: opts.unflipStagger,
        },
        "<",
      );
    }

    return tl;
  }

  function buildFlipOutTimeline(wrapper, letters, opts) {
    gsap.set(wrapper, { opacity: 1 });

    var tl = gsap.timeline({
      onComplete: function () {
        wrapper.classList.remove(opts.outlineClass);
        gsap.set(letters, { rotationX: 0, clearProps: "transform" });
        wrapper._rvContrarioTl = null;
      },
    });

    tl.to(wrapper, {
      duration: 0,
      onStart: function () {
        wrapper.classList.remove(opts.outlineClass);
      },
    }).to(letters, {
      rotationX: 0,
      duration: opts.unflipDuration,
      ease: "power2.inOut",
      stagger: opts.unflipStagger,
    });

    return tl;
  }

  function killTimeline(wrapper) {
    if (wrapper._rvContrarioTl) {
      wrapper._rvContrarioTl.kill();
      wrapper._rvContrarioTl = null;
    }
  }

  function resolveOpts(wrapper, options) {
    return Object.assign(
      {
        letterClass: FOOTER_LETTER_CLASS,
        outlineClass: FOOTER_OUTLINE_CLASS,
        repeat: 0,
        repeatDelay: 2,
        skipBlink: false,
        holdInverted: false,
      },
      FOOTER_TIMINGS,
      options || {},
    );
  }

  function getLetters(wrapper, opts) {
    splitLetters(wrapper, opts.letterClass);
    return wrapper.querySelectorAll("." + opts.letterClass);
  }

  window.ReversoContrarioFlip = {
    FOOTER_LETTER_CLASS: FOOTER_LETTER_CLASS,
    FOOTER_OUTLINE_CLASS: FOOTER_OUTLINE_CLASS,
    FOOTER_TIMINGS: FOOTER_TIMINGS,

    splitLetters: splitLetters,

    play: function (wrapper, options) {
      if (!wrapper || typeof gsap === "undefined") return null;

      var opts = resolveOpts(wrapper, options);
      var letters = getLetters(wrapper, opts);
      if (!letters.length) return null;

      if (wrapper._rvContrarioTl) return wrapper._rvContrarioTl;

      var onRepeat = opts.onRepeat;
      if (opts.repeat === -1 && !onRepeat) {
        onRepeat = function () {
          wrapper.classList.remove(opts.outlineClass);
        };
      }

      var tl = buildTimeline(wrapper, letters, {
        blinkDuration: opts.blinkDuration,
        outlineHold: opts.outlineHold,
        flipDuration: opts.flipDuration,
        flipStagger: opts.flipStagger,
        unflipDelay: opts.unflipDelay,
        unflipHold: opts.unflipHold,
        unflipDuration: opts.unflipDuration,
        unflipStagger: opts.unflipStagger,
        repeat: opts.repeat,
        repeatDelay: opts.repeatDelay,
        onRepeat: onRepeat,
        onComplete: opts.onComplete,
        outlineClass: opts.outlineClass,
        skipBlink: opts.skipBlink,
        holdInverted: opts.holdInverted,
      });

      wrapper._rvContrarioTl = tl;
      return tl;
    },

    /** Contorno + inversão; permanece invertido até flipOut. Sem piscadas. */
    flipIn: function (wrapper, options) {
      if (!wrapper || typeof gsap === "undefined") return null;

      killTimeline(wrapper);

      var opts = resolveOpts(wrapper, options);
      var letters = getLetters(wrapper, opts);
      if (!letters.length) return null;

      var tl = buildTimeline(wrapper, letters, {
        blinkDuration: opts.blinkDuration,
        outlineHold: opts.outlineHold,
        flipDuration: opts.flipDuration,
        flipStagger: opts.flipStagger,
        unflipDelay: opts.unflipDelay,
        unflipHold: opts.unflipHold,
        unflipDuration: opts.unflipDuration,
        unflipStagger: opts.unflipStagger,
        repeat: 0,
        repeatDelay: 0,
        outlineClass: opts.outlineClass,
        skipBlink: true,
        holdInverted: true,
      });

      wrapper._rvContrarioTl = tl;
      return tl;
    },

    /** Desinversão ao sair do hover / fechar CTA. */
    flipOut: function (wrapper, options) {
      if (!wrapper || typeof gsap === "undefined") return null;

      killTimeline(wrapper);

      var opts = resolveOpts(wrapper, options);
      var letters = getLetters(wrapper, opts);
      if (!letters.length) return null;

      var tl = buildFlipOutTimeline(wrapper, letters, {
        unflipDuration: opts.unflipDuration,
        unflipStagger: opts.unflipStagger,
        outlineClass: opts.outlineClass,
      });

      wrapper._rvContrarioTl = tl;
      return tl;
    },

    playOnce: function (wrapper, options) {
      if (!wrapper || wrapper.dataset.contrarioPlayed === "1") return null;
      wrapper.dataset.contrarioPlayed = "1";
      return this.play(wrapper, Object.assign({}, options, { repeat: 0 }));
    },
  };
})();
