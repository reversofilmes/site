/**
 * Marquee do rodapé: loop contínuo sem “buracos” na margem.
 * Palavra CONTRÁRIO no ticker: mesma sequência GSAP da intro (tempos levemente mais lentos para o rodapé).
 */
(function () {
  function splitContrarioLetters() {
    document.querySelectorAll('[data-marquee-contrario]').forEach(function (root) {
      if (root.querySelector('.site-footer__marquee-letter')) return;
      var text = root.textContent.trim();
      root.textContent = '';
      for (var i = 0; i < text.length; i++) {
        var s = document.createElement('span');
        s.className = 'site-footer__marquee-letter';
        s.textContent = text[i];
        root.appendChild(s);
      }
    });
  }

  splitContrarioLetters();

  /** Replica tempos/easing da intro para cada wrapper [data-marquee-contrario]. */
  function initContrarioTickerGsaps() {
    if (typeof gsap === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var syncProgress = null;
    document.querySelectorAll('[data-marquee-contrario]').forEach(function (w) {
      if (w._rvContrarioTl && syncProgress === null) {
        syncProgress = w._rvContrarioTl.progress();
      }
    });

    document.querySelectorAll('[data-marquee-contrario]').forEach(function (wrapper) {
      if (wrapper._rvContrarioTl) return;
      var letters = wrapper.querySelectorAll('.site-footer__marquee-letter');
      if (!letters.length) return;

      gsap.set(wrapper, { opacity: 1 });
      gsap.set(letters, {
        rotationX: 0,
        transformOrigin: 'center center',
        force3D: true,
      });

      var tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 4,
        onRepeat: function () {
          wrapper.classList.remove('site-footer__marquee-contrario-outline');
        },
      });

      tl.to(wrapper, { opacity: 0, duration: 0.1, ease: 'power2.inOut' })
        .to(wrapper, { opacity: 1, duration: 0.1, ease: 'power2.inOut' })
        .to(wrapper, { opacity: 0, duration: 0.1, ease: 'power2.inOut' })
        .to(wrapper, { opacity: 1, duration: 0.1, ease: 'power2.inOut' })
        .to(wrapper, {
          duration: 0.22,
          ease: 'power2.inOut',
          onStart: function () {
            wrapper.classList.add('site-footer__marquee-contrario-outline');
          },
        })
        .to(letters, {
          rotationX: 180,
          duration: 0.2,
          ease: 'power2.inOut',
          stagger: 0.13,
        })
        .to(
          wrapper,
          {
            duration: 0.32,
            ease: 'power2.inOut',
            onStart: function () {
              wrapper.classList.remove('site-footer__marquee-contrario-outline');
            },
          },
          '+=0.1',
        )
        .to(
          letters,
          {
            rotationX: 0,
            duration: 0.22,
            ease: 'power2.inOut',
            stagger: 0.022,
          },
          '<',
        );

      wrapper._rvContrarioTl = tl;
      if (syncProgress !== null) {
        tl.progress(syncProgress);
      }
    });
  }

  /* Largura do bloco meta = largura da linha de contatos; copyright justificado à mesma largura */
  let footerMetaResizeTimer = null;
  function syncFooterMetaToContact() {
    const meta = document.querySelector('.site-footer__meta');
    const contact = document.querySelector('.site-footer__contact');
    if (!meta || !contact) return;
    meta.style.width = '';
    /* Medir como uma única linha: rect.width após aplicar meta pode ficar estreito demais e
       ativar flex-wrap (email / telefone empilhados), visível sobretudo na Curupire-se (body flex). */
    const prevWrap = contact.style.flexWrap;
    contact.style.flexWrap = 'nowrap';
    const singleLine = Math.ceil(contact.scrollWidth);
    contact.style.flexWrap = prevWrap;

    const inner = meta.closest('.site-footer__inner');
    let cap = Infinity;
    if (inner) {
      const cs = window.getComputedStyle(inner);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      cap = Math.max(1, Math.floor(inner.clientWidth - padX));
    }

    const w = singleLine > 0 ? Math.min(singleLine, cap) : 0;

    if (w > 0) meta.style.width = w + 'px';
  }

  function scheduleFooterMetaSync() {
    syncFooterMetaToContact();
    requestAnimationFrame(syncFooterMetaToContact);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleFooterMetaSync);
  } else {
    window.addEventListener('load', scheduleFooterMetaSync, { once: true });
  }

  window.addEventListener(
    'resize',
    function () {
      clearTimeout(footerMetaResizeTimer);
      footerMetaResizeTimer = setTimeout(syncFooterMetaToContact, 120);
    },
    { passive: true },
  );

  setTimeout(scheduleFooterMetaSync, 400);

  const row = document.querySelector('.site-footer__marquee-row');
  const marquee = document.querySelector('.site-footer__marquee');
  const first = row && row.querySelector('.site-footer__marquee-group');
  if (!row || !first || !marquee) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let resizeTimer = null;
  let lastShiftPx = 0;

  function segmentWidthPx() {
    return Math.ceil(first.getBoundingClientRect().width);
  }

  function ensureEnoughClones() {
    const w = segmentWidthPx();
    if (w < 1) return;
    const minScroll = Math.ceil(marquee.clientWidth + w);
    let guard = 0;
    while (row.scrollWidth < minScroll && guard < 8) {
      row.appendChild(first.cloneNode(true));
      guard += 1;
    }
  }

  function applyShift() {
    ensureEnoughClones();
    initContrarioTickerGsaps();
    const w = segmentWidthPx();
    if (w < 1) return;
    row.style.setProperty('--marquee-shift', '-' + w + 'px');
    lastShiftPx = w;
  }

  function hardRestartAnimation() {
    row.style.animation = 'none';
    void row.offsetWidth;
    row.style.animation = '';
  }

  function startSynced() {
    applyShift();
    row.classList.add('is-marquee-synced');
    hardRestartAnimation();
  }

  function onResizeDebounced() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!row.classList.contains('is-marquee-synced')) return;
      const before = lastShiftPx;
      applyShift();
      const after = segmentWidthPx();
      if (after < 1) return;
      if (before < 1 || Math.abs(after - before) >= 1) {
        hardRestartAnimation();
      }
    }, 400);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      requestAnimationFrame(function () {
        requestAnimationFrame(startSynced);
      });
    });
  } else {
    window.addEventListener(
      'load',
      function () {
        requestAnimationFrame(startSynced);
      },
      { once: true },
    );
  }

  setTimeout(function () {
    if (!row.classList.contains('is-marquee-synced')) {
      startSynced();
    }
  }, 2000);

  window.addEventListener('resize', onResizeDebounced, { passive: true });
})();
