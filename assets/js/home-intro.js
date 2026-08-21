// Homepage Hero (intro + vídeo + bloco #home-below)
document.addEventListener("DOMContentLoaded", () => {
  const INTRO_DONE_KEY = "reverso_home_intro_done";

  const introContainer = document.getElementById("intro-text");
  const heroOverlay = document.querySelector(".home-hero__overlay");
  const homeBelow = document.getElementById("home-below");
  const scrollHint = document.getElementById("scroll-hint");
  const heroContainer = document.getElementById("home-hero");
  const masonryContainer = document.getElementById("masonry-container");
  const masonryGrid = masonryContainer?.querySelector(".projects-grid");

  // ── Hero video resilience ─────────────────────────────────────────
  // Responsive hero: desktop (>1024px) and mobile (<=1024px) videos.
  // Only the visible one is managed; the hidden one stays paused.
  const heroVideoDesktop = document.getElementById("home-hero-video-desktop");
  const heroVideoMobile = document.getElementById("home-hero-video-mobile");
  const heroMql = window.matchMedia("(max-width: 1024px)");

  function getActiveHeroVideo() {
    if (heroMql.matches) return heroVideoMobile || heroVideoDesktop;
    return heroVideoDesktop || heroVideoMobile;
  }

  function getInactiveHeroVideo() {
    const active = getActiveHeroVideo();
    const other = heroMql.matches ? heroVideoDesktop : heroVideoMobile;
    if (!other || other === active) return null;
    return other;
  }

  let heroVideo = getActiveHeroVideo();
  const HERO_LOG_PREFIX = "[hero-video]";
  const HERO_FAILED_FLAG = "reverso_hero_video_failed";
  let heroSourceEl = heroVideo ? heroVideo.querySelector("source") : null;
  let heroOriginalSrc = null;
  let heroCacheBustSeq = 0;
  let heroPlayAttemptSeq = 0;
  let heroHealthTimer = null;
  let heroProgressTimer = null;
  let heroHasPlayedOnce = false;
  // Monitor de progresso de frames. Quando o vídeo "diz" que está
  // tocando (paused=false) mas currentTime não avança, o decoder está
  // travado — tipicamente por bytes corrompidos entregues pelo WEBrick
  // ou pelo media cache do Chromium reutilizando uma cópia ruim.
  let heroLastCurrentTime = null;
  let heroLastProgressTimestamp = 0;

  // Dev local: `jekyll serve` + WEBrick + arquivo grande tem um padrão
  // conhecido de servir respostas parciais que o Chrome cacheia em um
  // estado quebrado. O próprio Cache-Control `no-store` do WEBrick
  // deveria impedir isso, mas o media cache do Chromium é separado do
  // cache HTTP e às vezes reusa bytes inválidos. Em produção o vídeo
  // virá de R2/D1 com cabeçalhos sãos, então só ativamos o cache-bust
  // preemptivo em desenvolvimento.
  const heroIsLocalDev = (function () {
    try {
      const h = window.location.hostname;
      return (
        h === "localhost" ||
        h === "127.0.0.1" ||
        h === "0.0.0.0" ||
        h.endsWith(".local")
      );
    } catch (_) {
      return false;
    }
  })();

  let heroHadPreviousFailure = false;
  try {
    heroHadPreviousFailure =
      sessionStorage.getItem(HERO_FAILED_FLAG) === "1";
  } catch (_) {}

  function markHeroFailed() {
    try {
      sessionStorage.setItem(HERO_FAILED_FLAG, "1");
    } catch (_) {}
    heroHadPreviousFailure = true;
  }

  function clearHeroFailedFlag() {
    try {
      sessionStorage.removeItem(HERO_FAILED_FLAG);
    } catch (_) {}
    heroHadPreviousFailure = false;
  }

  function heroLog() {
    if (typeof console === "undefined") return;
    try {
      const args = Array.prototype.slice.call(arguments);
      args.unshift(HERO_LOG_PREFIX);
      (console.debug || console.log).apply(console, args);
    } catch (_) {}
  }

  function getHeroBaseSrc() {
    if (!heroSourceEl) return null;
    if (heroOriginalSrc === null) {
      const raw = heroSourceEl.getAttribute("src") || "";
      // Remove qualquer query existente para não concatenar várias
      // vezes caso a função seja chamada múltiplas vezes.
      heroOriginalSrc = raw.split("?")[0];
    }
    return heroOriginalSrc;
  }

  function clearHeroInlineHiders() {
    if (heroContainer) {
      heroContainer.style.opacity = "";
      heroContainer.style.visibility = "";
      heroContainer.style.transform = "";
    }
    if (heroVideo) {
      heroVideo.style.opacity = "";
      heroVideo.style.visibility = "";
      heroVideo.style.display = "";
    }
    const inactive = getInactiveHeroVideo();
    if (inactive) {
      inactive.style.opacity = "";
      inactive.style.visibility = "";
    }
  }

  function heroVideoHasError() {
    if (!heroVideo) return false;
    // MediaError presente OU networkState NO_SOURCE (3).
    return !!heroVideo.error || heroVideo.networkState === 3;
  }

  function heroIsStillFetching() {
    if (!heroVideo) return false;
    // NETWORK_LOADING = 2: o browser ainda está baixando. Não é travamento.
    return heroVideo.networkState === 2 && !heroVideo.error;
  }

  function heroVideoLooksStuck() {
    if (!heroVideo) return false;
    if (heroVideoHasError()) return true;
    if (heroIsStillFetching()) return false;
    // Sem metadados e sem fetch ativo: o pipeline parou de verdade.
    if (heroVideo.paused && heroVideo.readyState < 2 && heroVideo.networkState !== 2) {
      return true;
    }
    return false;
  }

  function heroVideoHasNoProgress() {
    // Detecta o caso sutil: paused=false, readyState alto, mas o
    // decoder não está avançando frames. É o que faz o usuário ver
    // "tela preta" quando o vídeo *tecnicamente* está tocando.
    if (!heroVideo) return false;
    if (heroVideo.paused) return false;
    if (heroIsStillFetching()) return false;
    // Sem metadata o currentTime fica em 0 — isso é download, não decoder.
    if (heroVideo.readyState < 1) return false;
    if (heroLastProgressTimestamp === 0) return false;
    const stuckAtZero = heroVideo.currentTime < 0.05;
    return stuckAtZero && Date.now() - heroLastProgressTimestamp > 2500;
  }

  function reloadHeroVideoPlain() {
    if (!heroVideo) return;
    try {
      heroVideo.pause();
    } catch (_) {}
    try {
      // load() reseta o pipeline de mídia e força nova tentativa com a
      // mesma URL. Útil para bfcache, mas NÃO contorna cache HTTP do
      // Chrome com resposta corrompida — veja reloadHeroVideoWithCacheBust.
      heroVideo.load();
      heroLog("load() simples disparado. readyState =", heroVideo.readyState);
    } catch (err) {
      heroLog("load() falhou:", err);
    }
  }

  function reloadHeroVideoWithCacheBust(reason) {
    // Em produção o cache-bust aborta o download em curso, troca a URL
    // (?_rv=) e força 22 MB de novo — piorando o first load. Só faz
    // sentido no WEBrick local, onde o media cache do Chrome corrompe.
    if (!heroIsLocalDev) {
      heroLog("cache-bust ignorado em produção. motivo =", reason);
      tryPlayHeroVideo();
      return;
    }
    if (!heroVideo || !heroSourceEl) return;
    const base = getHeroBaseSrc();
    if (!base) return;
    heroCacheBustSeq += 1;
    const bustedSrc =
      base + "?_rv=" + Date.now().toString(36) + "-" + heroCacheBustSeq;
    try {
      heroVideo.pause();
    } catch (_) {}
    // Trocar o src do <source> e chamar load() é o caminho mais
    // confiável no Chrome/Firefox/Safari — o pipeline de mídia é
    // resetado e re-itera pelos <source>.
    heroSourceEl.setAttribute("src", bustedSrc);
    try {
      heroVideo.load();
      heroLog(
        "cache-bust #" + heroCacheBustSeq + " (motivo: " + reason + "). src =",
        bustedSrc,
      );
    } catch (err) {
      heroLog("cache-bust load() falhou:", err);
    }
  }

  function tryPlayHeroVideo() {
    if (!heroVideo) return;
    const p = heroVideo.play?.();
    if (p && typeof p.catch === "function") {
      p.catch((err) => {
        // NotAllowedError → autoplay negado (usuário precisa interagir).
        // AbortError → interrompido por outro play()/load(). Ignorar.
        // Outros → tipicamente estado inválido do elemento.
        if (err && err.name && err.name !== "AbortError") {
          heroLog("play() rejeitado:", err.name, err.message || "");
        }
      });
    }
  }

  function runHealthCheck(attemptSeq) {
    if (attemptSeq !== heroPlayAttemptSeq) return;
    if (!heroVideo) return;

    const stuck = heroVideoLooksStuck();
    const noProgress = heroVideoHasNoProgress();
    if (!stuck && !noProgress) return;

    heroLog(
      "health-check:",
      stuck ? "travado" : "sem progresso",
      "— paused =", heroVideo.paused,
      "readyState =", heroVideo.readyState,
      "networkState =", heroVideo.networkState,
      "currentTime =", heroVideo.currentTime,
      "error =", heroVideo.error && heroVideo.error.code,
    );
    if (heroIsLocalDev) {
      markHeroFailed();
      reloadHeroVideoWithCacheBust(stuck ? "health-check" : "no-progress");
    }
    tryPlayHeroVideo();

    // Agenda um segundo health-check depois do cache-bust. Se ainda
    // assim não rodou, algo mais sério está acontecendo — logamos e
    // tentamos mais uma recuperação (evita loop infinito de cache-busts).
    setTimeout(() => {
      if (attemptSeq !== heroPlayAttemptSeq) return;
      if (!heroVideoLooksStuck() && !heroVideoHasNoProgress()) return;
      heroLog(
        "ainda travado/sem progresso após cache-bust.",
        "readyState =", heroVideo.readyState,
        "currentTime =", heroVideo.currentTime,
        "— tentando mais uma vez.",
      );
      reloadHeroVideoWithCacheBust("health-check-retry");
      tryPlayHeroVideo();
    }, 2500);
  }

  function runProgressCheck(attemptSeq) {
    // Check separado que roda mais tarde, especificamente para o caso
    // "vídeo diz que está tocando mas currentTime não sai do zero".
    // Comum ao voltar de outra página pelo menu.
    if (attemptSeq !== heroPlayAttemptSeq) return;
    if (!heroVideo) return;
    if (!heroVideoHasNoProgress()) return;

    heroLog(
      "progress-check detectou decoder travado (paused=false, currentTime=" +
        heroVideo.currentTime + ").",
    );
    if (heroIsLocalDev) {
      markHeroFailed();
      reloadHeroVideoWithCacheBust("progress-check");
    }
    tryPlayHeroVideo();
  }

  let heroInitialBootstrapDone = false;

  function ensureHeroVideoPlayback(opts) {
    if (!heroVideo) return;
    const forceReload = !!(opts && opts.forceReload);
    const forceCacheBust = !!(opts && opts.forceCacheBust);

    clearHeroInlineHiders();

    heroVideo.muted = true;
    heroVideo.defaultMuted = true;
    try {
      heroVideo.setAttribute("muted", "");
    } catch (_) {}
    heroVideo.playsInline = true;
    heroVideo.loop = true;

    // Cache-bust preemptivo só no WEBrick local. Em produção uma
    // "falha" anterior quase sempre foi first-load lento (moov no
    // fim + contenção), não cache corrompido — bustar de novo
    // descarta o Cache-Control de 1 ano e rebaixa o arquivo inteiro.
    if (
      !heroInitialBootstrapDone &&
      !forceCacheBust &&
      !forceReload &&
      heroIsLocalDev
    ) {
      heroLog(
        "bootstrap com cache-bust preemptivo.",
        "localDev =", heroIsLocalDev,
        "previousFailure =", heroHadPreviousFailure,
      );
      reloadHeroVideoWithCacheBust(
        heroHadPreviousFailure ? "sticky-failure" : "dev-preemptive",
      );
    } else if (forceCacheBust) {
      reloadHeroVideoWithCacheBust("forceCacheBust");
    } else if (forceReload || heroVideoHasError()) {
      reloadHeroVideoPlain();
    }
    heroInitialBootstrapDone = true;

    const attemptSeq = ++heroPlayAttemptSeq;

    tryPlayHeroVideo();
    requestAnimationFrame(() => {
      if (attemptSeq !== heroPlayAttemptSeq) return;
      tryPlayHeroVideo();
      requestAnimationFrame(() => {
        if (attemptSeq === heroPlayAttemptSeq) tryPlayHeroVideo();
      });
    });
    [80, 250, 600, 1200].forEach((ms) => {
      setTimeout(() => {
        if (attemptSeq === heroPlayAttemptSeq) tryPlayHeroVideo();
      }, ms);
    });

    if (!heroVideo.dataset.reversoNudgeBound) {
      heroVideo.dataset.reversoNudgeBound = "1";
      // Dispara assim que houver dados suficientes para tocar.
      heroVideo.addEventListener("loadeddata", tryPlayHeroVideo);
      heroVideo.addEventListener("canplay", tryPlayHeroVideo);
      // `timeupdate` é o único evento que confirma avanço real de
      // frames. Registrar aqui alimenta heroVideoHasNoProgress().
      heroVideo.addEventListener("timeupdate", () => {
        if (heroVideo.currentTime !== heroLastCurrentTime) {
          heroLastCurrentTime = heroVideo.currentTime;
          heroLastProgressTimestamp = Date.now();
        }
      });
      // `playing` confirma que o vídeo está realmente rodando. Usamos
      // para limpar a flag de "falha anterior" — a partir daqui
      // reloads subsequentes não precisarão de cache-bust preemptivo.
      heroVideo.addEventListener("playing", () => {
        if (!heroHasPlayedOnce) {
          heroHasPlayedOnce = true;
          heroLog("playing — vídeo tocando de verdade. readyState =", heroVideo.readyState);
        }
        // Arma o monitor de progresso. Sem isso, heroVideoHasNoProgress
        // retornaria true por causa de heroLastProgressTimestamp=0.
        heroLastProgressTimestamp = Date.now();
        clearHeroFailedFlag();
      });
      // Auto-recuperação de erro. Ignoramos MEDIA_ERR_ABORTED (code 1)
      // porque isso é disparado quando NÓS mesmos fazemos um cache-bust
      // — se entrássemos em recovery aqui, teríamos loop de aborts.
      heroVideo.addEventListener("error", () => {
        const code = heroVideo.error && heroVideo.error.code;
        if (code === 1) {
          heroLog("error MEDIA_ERR_ABORTED (code 1) — ignorando (provável abort interno).");
          return;
        }
        heroLog("evento error. code =", code);
        if (heroIsLocalDev) {
          markHeroFailed();
          setTimeout(() => {
            reloadHeroVideoWithCacheBust("media-error");
            tryPlayHeroVideo();
          }, 200);
        } else {
          setTimeout(() => {
            reloadHeroVideoPlain();
            tryPlayHeroVideo();
          }, 200);
        }
      });
      // Logs diagnósticos dos eventos iniciais — ajudam a entender por
      // que a recuperação às vezes não funciona.
      heroVideo.addEventListener("loadstart", () => {
        heroLog("loadstart — fetch iniciando.");
      });
      heroVideo.addEventListener("loadedmetadata", () => {
        heroLog(
          "loadedmetadata — duration =", heroVideo.duration,
          "readyState =", heroVideo.readyState,
        );
      });
      heroVideo.addEventListener("waiting", () => {
        // Buffering durante playback. Se persistir é sinal de problema.
        heroLog(
          "waiting — bufferando. currentTime =", heroVideo.currentTime,
          "readyState =", heroVideo.readyState,
        );
      });
      // `stalled` / `suspend` no first load costumam ser o browser
      // pausando o fetch porque outros <video> ocuparam as conexões
      // — não cache corrompido. Em produção só tentamos play().
      heroVideo.addEventListener("stalled", () => {
        if (heroVideo.readyState < 2) {
          heroLog("stalled com readyState <2.");
          if (heroIsLocalDev) {
            markHeroFailed();
            reloadHeroVideoWithCacheBust("stalled");
          } else {
            tryPlayHeroVideo();
          }
        }
      });
      heroVideo.addEventListener("suspend", () => {
        if (heroVideo.readyState === 0 && heroVideo.networkState !== 1) {
          heroLog("suspend com readyState=0.");
          if (heroIsLocalDev) {
            markHeroFailed();
            reloadHeroVideoWithCacheBust("suspend-empty");
          } else {
            tryPlayHeroVideo();
          }
        }
      });
      // Se algo pausar inadvertidamente (bfcache Safari, visibilidade),
      // tenta retomar.
      heroVideo.addEventListener("pause", () => {
        if (document.hidden) return;
        setTimeout(() => {
          if (!heroVideo.paused) return;
          if (!document.hidden) tryPlayHeroVideo();
        }, 120);
      });
    }

    // Só zera os trackers quando de fato reiniciamos o pipeline.
    // ensure() roda em pageshow/load/intro — resetar sempre fazia o
    // health-check achar "sem progresso" e abortar o download.
    if (forceReload || forceCacheBust) {
      heroLastCurrentTime = null;
      heroLastProgressTimestamp = 0;
    }

    // Health-check: detecta travamento "silencioso" (nunca disparou
    // error mas o vídeo nunca tocou) e aplica cache-bust (só em dev).
    if (heroHealthTimer) clearTimeout(heroHealthTimer);
    heroHealthTimer = setTimeout(() => runHealthCheck(attemptSeq), 1500);
    // Progress-check mais tardio: pega especificamente o caso de
    // "playing mas currentTime parado em 0". Precisa de mais tempo
    // para dar chance do decoder emitir pelo menos um timeupdate.
    if (heroProgressTimer) clearTimeout(heroProgressTimer);
    heroProgressTimer = setTimeout(() => runProgressCheck(attemptSeq), 3000);
  }

  function detachHeroSource(videoEl) {
    if (!videoEl) return;
    try { videoEl.pause(); } catch (_) {}
    videoEl.removeAttribute("autoplay");
    videoEl.preload = "none";
    const srcEl = videoEl.querySelector("source");
    if (srcEl && srcEl.getAttribute("src")) {
      srcEl.setAttribute("data-src", srcEl.getAttribute("src"));
      srcEl.removeAttribute("src");
      try { videoEl.load(); } catch (_) {}
    }
  }

  function attachHeroSource(videoEl) {
    if (!videoEl) return;
    const srcEl = videoEl.querySelector("source");
    if (srcEl && !srcEl.getAttribute("src")) {
      const saved = srcEl.getAttribute("data-src");
      if (saved) srcEl.setAttribute("src", saved);
    }
    videoEl.preload = "auto";
  }

  (function pauseInactiveHeroOnBoot() {
    const inactive = getInactiveHeroVideo();
    if (inactive) detachHeroSource(inactive);
  })();

  // Switch active hero video on breakpoint change (desktop <-> mobile)
  function switchHeroVideo() {
    const prev = heroVideo;
    const next = getActiveHeroVideo();
    const inactive = getInactiveHeroVideo();
    if (next === prev && prev) return;
    if (prev) detachHeroSource(prev);
    if (inactive && inactive !== next) detachHeroSource(inactive);
    heroVideo = next;
    attachHeroSource(heroVideo);
    heroSourceEl = heroVideo ? heroVideo.querySelector("source") : null;
    heroOriginalSrc = null;
    heroInitialBootstrapDone = false;
    heroHasPlayedOnce = false;
    heroLastCurrentTime = null;
    heroLastProgressTimestamp = 0;
    if (heroVideo) ensureHeroVideoPlayback({ forceReload: true });
  }

  try {
    heroMql.addEventListener("change", switchHeroVideo);
  } catch (_) {
    heroMql.addListener(switchHeroVideo);
  }

  // Devem existir em todos os caminhos (incl. intro já vista no sessionStorage);
  // não podem ficar abaixo de um return antecipado.
  window.addEventListener("pageshow", (ev) => {
    // bfcache: o elemento volta em estado imprevisível. Forçamos load().
    const fromCache = !!(ev && ev.persisted);
    ensureHeroVideoPlayback({ forceReload: fromCache });
    if (fromCache) {
      // Reforço — alguns navegadores precisam de um segundo empurrão.
      setTimeout(() => ensureHeroVideoPlayback({}), 80);
      setTimeout(() => ensureHeroVideoPlayback({}), 400);
    }
  });
  window.addEventListener("load", () => {
    ensureHeroVideoPlayback();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) ensureHeroVideoPlayback();
  });

  try {
    window.__reversoHeroVideo = {
      ensure: ensureHeroVideoPlayback,
      cacheBust: () => reloadHeroVideoWithCacheBust("manual"),
      switchVideo: switchHeroVideo,
      status: () => ({
        active: heroVideo && heroVideo.id,
        paused: heroVideo && heroVideo.paused,
        readyState: heroVideo && heroVideo.readyState,
        networkState: heroVideo && heroVideo.networkState,
        error: heroVideo && heroVideo.error && heroVideo.error.code,
        currentSrc: heroVideo && heroVideo.currentSrc,
      }),
    };
  } catch (_) {}

  function revealHomeContent() {
    if (introContainer) {
      introContainer.classList.add("hidden");
      introContainer.style.display = "none";
    }
    if (heroOverlay) {
      heroOverlay.style.opacity = "1";
      heroOverlay.style.visibility = "visible";
    }
    if (homeBelow) {
      homeBelow.classList.add("home-below--visible");
      homeBelow.style.opacity = "1";
      if (typeof gsap !== "undefined") {
        gsap.set(homeBelow, { opacity: 1 });
      }
    }
    if (scrollHint) {
      scrollHint.classList.add("home-hero__scroll--visible");
    }
    if (masonryContainer) {
      masonryContainer.classList.add("grid-enabled");
    }
    if (masonryGrid) {
      masonryGrid.classList.add("visible");
    }
    ensureHeroVideoPlayback();
    if (typeof initMasonry === "function") {
      initMasonry();
    }
    try {
      window.dispatchEvent(new CustomEvent("reverso:intro-complete"));
    } catch (_) {}
  }

  function markIntroDone() {
    try {
      sessionStorage.setItem(INTRO_DONE_KEY, "1");
    } catch (_) {}
  }

  function runIntroAnimation() {
    if (typeof gsap === "undefined") {
      console.error("GSAP not loaded, intro animation cannot run");
      revealHomeContent();
      return;
    }

    const introText = introContainer?.querySelector(".intro-text");
    if (!introContainer || !introText) {
      console.warn("Intro text elements not found");
      revealHomeContent();
      return;
    }

    const line1 = introText.querySelector(".intro-line-1");
    const line2 = introText.querySelector(".intro-line-2");
    const line3 = introText.querySelector(".intro-line-3.intro-mundo");
    const line4a = introText.querySelector(".intro-line-4a");
    const line4b = introText.querySelector(".intro-line-4b");

    if (!line1 || !line2 || !line3 || !line4a || !line4b) {
      console.warn("Intro line elements not found");
      revealHomeContent();
      return;
    }

    const contrarioText = line4b.textContent;
    line4b.innerHTML = "";
    const letters = [];
    for (let i = 0; i < contrarioText.length; i++) {
      const letterSpan = document.createElement("span");
      letterSpan.className = "letter";
      letterSpan.textContent = contrarioText[i];
      line4b.appendChild(letterSpan);
      letters.push(letterSpan);
    }

    gsap.set([line1, line2, line3, line4a, line4b], {
      opacity: 0,
      y: -50,
      scale: 0.9,
    });
    gsap.set(introText, { opacity: 1 });
    gsap.set(letters, { opacity: 1, rotationX: 0 });
    if (heroOverlay) {
      gsap.set(heroOverlay, { opacity: 0, visibility: "hidden" });
    }
    if (homeBelow) {
      gsap.set(homeBelow, { opacity: 0 });
    }
    if (scrollHint) {
      gsap.set(scrollHint, { opacity: 0 });
    }

    const calculateWidths = () => {
      const origDisplay4a = line4a.style.display;
      const origDisplay4b = line4b.style.display;
      const origDisplay3 = line3.style.display;

      line4a.style.display = "inline-block";
      line4b.style.display = "inline-block";
      line3.style.display = "block";

      const rect4a = line4a.getBoundingClientRect();
      const rect4b = line4b.getBoundingClientRect();
      const contrarioHeight = rect4b.height;
      const contrarioWidth = rect4b.width;

      if (Math.abs(rect4a.height - contrarioHeight) > 1) {
        const scaleFactor = contrarioHeight / rect4a.height;
        const currentFontSize = parseFloat(getComputedStyle(line4a).fontSize);
        line4a.style.fontSize = currentFontSize * scaleFactor + "px";
        const rect4aNew = line4a.getBoundingClientRect();
        gsap.set(line3, { width: rect4aNew.width + contrarioWidth });
      } else {
        gsap.set(line3, { width: rect4a.width + contrarioWidth });
      }

      line4a.style.display = origDisplay4a || "";
      line4b.style.display = origDisplay4b || "";
      line3.style.display = origDisplay3 || "";
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(calculateWidths);
    } else {
      setTimeout(calculateWidths, 300);
    }

    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(calculateWidths, 250);
    });

    const tl = gsap.timeline({
      onComplete: () => {
        introContainer.classList.add("hidden");
        introContainer.style.display = "none";
        markIntroDone();
      },
    });

    tl.to(line1, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.15,
      ease: "power3.out",
    })
      .to(
        line2,
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.15,
          ease: "power3.out",
        },
        0.2,
      )
      .to(
        line3,
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.2,
          ease: "power3.out",
        },
        0.4,
      )
      .to(
        [line4a, line4b],
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.2,
          ease: "power3.out",
        },
        0.7,
      )
      .to(line4b, { opacity: 0, duration: 0.06, ease: "power2.inOut" }, 1.0)
      .to(line4b, { opacity: 1, duration: 0.06, ease: "power2.inOut" }, 1.12)
      .to(line4b, { opacity: 0, duration: 0.06, ease: "power2.inOut" }, 1.18)
      .to(line4b, { opacity: 1, duration: 0.06, ease: "power2.inOut" }, 1.24)
      .to(
        line4b,
        {
          duration: 0.15,
          ease: "power2.inOut",
          onStart: () => {
            line4b.classList.add("intro-line-4b-outline");
          },
        },
        1.3,
      )
      .to(
        letters,
        {
          rotationX: 180,
          duration: 0.14,
          ease: "power2.inOut",
          stagger: 0.1,
        },
        1.5,
      )
      .to(
        line4b,
        {
          duration: 0.25,
          ease: "power2.inOut",
          onStart: () => {
            line4b.classList.remove("intro-line-4b-outline");
          },
        },
        2.5,
      )
      .to(
        letters,
        {
          rotationX: 0,
          duration: 0.15,
          ease: "power2.inOut",
          stagger: 0.015,
        },
        2.5,
      )
      .call(
        () => {
          if (masonryContainer) masonryContainer.classList.add("grid-enabled");
          if (masonryGrid) masonryGrid.classList.add("visible");
          ensureHeroVideoPlayback();
          if (typeof initMasonry === "function") initMasonry();
        },
        null,
        2.7,
      )
      .to(
        [line1, line2, line3, line4a, line4b],
        {
          opacity: 0,
          y: -30,
          scale: 0.95,
          duration: 0.8,
          ease: "power2.in",
          stagger: 0.03,
        },
        2.7,
      );

    if (heroOverlay) {
      tl.to(
        heroOverlay,
        {
          opacity: 1,
          visibility: "visible",
          duration: 0.8,
          ease: "power2.out",
        },
        2.7,
      );
    }

    if (homeBelow) {
      tl.to(
        homeBelow,
        {
          opacity: 1,
          duration: 0.8,
          ease: "power2.out",
          onStart: () => {
            homeBelow.classList.add("home-below--visible");
          },
        },
        2.7,
      );
    }

    if (scrollHint) {
      tl.to(
        scrollHint,
        {
          opacity: 1,
          duration: 0.6,
          ease: "power2.out",
          onComplete: () => {
            scrollHint.classList.add("home-hero__scroll--visible");
          },
        },
        3.0,
      );
    }

    tl.call(() => {
      try {
        window.dispatchEvent(new CustomEvent("reverso:intro-complete"));
      } catch (_) {}
    });
  }

  function getMaxGridOverlap() {
    return Math.min(window.innerHeight * 0.055, 64);
  }

  const mobileStableScrollFx = window.matchMedia("(max-width: 1024px)").matches;

  function updateHomeScrollFx() {
    if (!homeBelow) return;

    if (mobileStableScrollFx) {
      const revealed = window.scrollY > 24;
      document.body.classList.toggle("home-grid-revealed", revealed);
      homeBelow.style.setProperty("--home-grid-overlap", "0px");
      if (scrollHint) {
        scrollHint.classList.toggle("home-hero__scroll--hidden", revealed);
        scrollHint.classList.toggle("home-hero__scroll--visible", !revealed);
      }
      return;
    }

    const vh = window.innerHeight || 1;
    const y = window.scrollY;
    const revealAt = vh * 0.08;
    const overlapEnd = vh * 0.42;
    const maxOverlap = getMaxGridOverlap();
    const revealed = y >= revealAt;

    document.body.classList.toggle("home-grid-revealed", revealed);

    const overlapProgress = Math.min(
      1,
      Math.max(0, (y - revealAt) / Math.max(overlapEnd - revealAt, 1)),
    );
    homeBelow.style.setProperty(
      "--home-grid-overlap",
      `${overlapProgress * maxOverlap}px`,
    );

    if (scrollHint) {
      scrollHint.classList.toggle("home-hero__scroll--hidden", revealed);
      scrollHint.classList.toggle("home-hero__scroll--visible", !revealed);
    }
  }

  let scrollFxTicking = false;
  function onHomeScrollFx() {
    if (scrollFxTicking) return;
    scrollFxTicking = true;
    requestAnimationFrame(() => {
      updateHomeScrollFx();
      scrollFxTicking = false;
    });
  }

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (reduceMotion) {
    document.body.classList.add("home-grid-revealed");
  } else {
    window.addEventListener("scroll", onHomeScrollFx, { passive: true });
    updateHomeScrollFx();
  }

  window.addEventListener("pageshow", (ev) => {
    if (ev && ev.persisted) updateHomeScrollFx();
  });

  let introAlreadySeen = false;
  try {
    introAlreadySeen = sessionStorage.getItem(INTRO_DONE_KEY) === "1";
  } catch (_) {}

  if (introAlreadySeen && introContainer) {
    introContainer.classList.add("hidden");
    introContainer.style.display = "none";
  }

  if (introAlreadySeen) {
    revealHomeContent();
  } else if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    revealHomeContent();
    markIntroDone();
  } else if (introContainer) {
    runIntroAnimation();
  } else {
    revealHomeContent();
  }
});
