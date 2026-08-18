/**
 * Alpine.js data and methods for the Projects page
 * Listagem: sempre por date_yymmdd (mais recente primeiro), após filtros Buscar + Categoria + Serviços.
 */

const PROJECT_CATEGORIES = [
  'Festivais & Eventos',
  'Arte & Cultura',
  'Corporativo',
];

const PROJECT_SERVICE_TYPES = [
  'Aftermovie & Reels',
  'Institucional',
  'Publicitário',
  'Motion & VFX',
  'Conteúdo Mobile',
  'Fotografia & GIFs',
];

/** Legado: nomes antigos em service_types → novos rótulos (filtros / links antigos). */
const LEGACY_SERVICE_ALIASES = {
  'FESTIVAIS & EVENTOS': 'Festivais & Eventos',
  'ARTE & CULTURA': 'Arte & Cultura',
  'EVENTO CORPORATIVO': 'Corporativo',
  EVENTOS: 'Festivais & Eventos',
  FOTOS: 'Fotografia & GIFs',
  MOBILE: 'Conteúdo Mobile',
  INSTITUCIONAL: 'Institucional',
  PUBLICITÁRIO: 'Publicitário',
  'ANIMAÇÃO & MOTION GRAPHICS': 'Motion & VFX',
  'EFEITOS VISUAIS': 'Motion & VFX',
  VFX: 'Motion & VFX',
  'MAKING OF': 'Aftermovie & Reels',
  DOCUMENTÁRIO: 'Institucional',
  'MIDIAS SOCIAIS': 'Conteúdo Mobile',
  ARTISTICOS: 'Aftermovie & Reels',
};

/**
 * Códigos curtos na URL (iniciais por palavra; caracteres especiais ignorados).
 * Resolve colisões e evita ambiguidade por prefixo (ex.: E vs EC).
 */
function stripDiacritics(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function lettersCompact(name) {
  return stripDiacritics(name).replace(/[^A-Za-z]/g, '').toUpperCase();
}

function preferredInitials(name) {
  const parts = stripDiacritics(name)
    .split(/[\s&/–—,.]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  let code = '';
  for (const part of parts) {
    if (/^\d+$/.test(part)) continue;
    const m = part.match(/[A-Za-z]/);
    if (m) code += m[0].toUpperCase();
  }
  const c = lettersCompact(name);
  if (!code && c) return c[0];
  return code;
}

function hasPrefixConflict(candidate, codes) {
  const up = candidate.toUpperCase();
  for (const u of codes) {
    if (!u) continue;
    if (u === up) return true;
    if (u.startsWith(up) || up.startsWith(u)) return true;
  }
  return false;
}

function buildServiceUrlMaps(labels) {
  const sorted = [
    ...new Set(labels.map((x) => String(x || '').trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const labelToCode = new Map();
  const assigned = [];

  const rows = sorted.map((label) => ({
    label,
    pref: preferredInitials(label),
    compact: lettersCompact(label),
  }));

  rows.sort((a, b) => {
    if (b.pref.length !== a.pref.length) return b.pref.length - a.pref.length;
    return a.label.localeCompare(b.label, 'pt-BR');
  });

  for (const { label, pref, compact } of rows) {
    if (!compact) {
      const code = `S${labelToCode.size + 1}`;
      assigned.push(code);
      labelToCode.set(label, code);
      continue;
    }

    let chosen = null;

    if (pref && !hasPrefixConflict(pref, assigned)) {
      chosen = pref.toUpperCase();
    }

    if (!chosen) {
      let n = Math.max(pref.length || 1, 1);
      while (n <= compact.length) {
        const cand = compact.slice(0, n);
        if (!hasPrefixConflict(cand, assigned)) {
          chosen = cand;
          break;
        }
        n += 1;
      }
    }

    if (!chosen) {
      let base = (pref && pref.slice(0, 3)) || compact.slice(0, 3);
      let i = 2;
      while (hasPrefixConflict(`${base}${i}`, assigned)) i += 1;
      chosen = `${base}${i}`;
    }

    assigned.push(chosen);
    labelToCode.set(label, chosen);
  }

  const toCode = {};
  const fromCode = {};
  labelToCode.forEach((code, label) => {
    const k = String(code).toUpperCase();
    toCode[label] = k;
    fromCode[k] = label;
  });

  return { toCode, fromCode };
}

function projectsPage(projectsJsonUrl) {
  return {
    allProjects: [],
    filteredProjects: [],
    loading: true,
    error: null,
    projectsJsonUrl: projectsJsonUrl || '/projects.json',

    searchTerm: '',
    selectedCategories: [],
    selectedServiceTypes: [],
    showFilters: false,

    availableCategories: PROJECT_CATEGORIES,
    availableServiceTypes: PROJECT_SERVICE_TYPES,

    /** label canónico → código URL */
    _categoryToUrlCode: {},
    _urlCodeToCategory: {},
    _serviceToUrlCode: {},
    _urlCodeToService: {},

    urlSyncTimer: null,

    _dateSortKey(s) {
      const raw = String(s || '').replace(/\D/g, '');
      if (raw.length === 6) return raw;
      return '000000';
    },

    _sortByDateDesc(list) {
      list.sort((a, b) => {
        const ka = this._dateSortKey(a.date_yymmdd);
        const kb = this._dateSortKey(b.date_yymmdd);
        if (ka !== kb) return kb.localeCompare(ka);
        const sa = a.slug || a.url || '';
        const sb = b.slug || b.url || '';
        return sa.localeCompare(sb, 'pt-BR');
      });
    },

    _unescapeUrlToken(raw) {
      let v = String(raw || '');
      for (let i = 0; i < 4; i++) {
        try {
          const d = decodeURIComponent(v.replace(/\+/g, ' '));
          if (d === v) break;
          v = d;
        } catch (_) {
          break;
        }
      }
      return v;
    },

    _matchLabelFromUrl(raw, allowedSet) {
      let v = String(raw || '').trim();
      if (!v) return null;
      if (allowedSet.has(v)) return v;
      for (let i = 0; i < 4; i++) {
        try {
          const d = decodeURIComponent(v.replace(/\+/g, ' '));
          if (d === v) break;
          v = d.trim();
          if (allowedSet.has(v)) return v;
        } catch (_) {
          break;
        }
      }
      return null;
    },

    _resolveCategoryCandidate(raw, allowedSet) {
      const v = String(raw || '').trim();
      if (!v) return null;
      if (allowedSet.has(v)) return v;

      const fromCode = this._urlCodeToCategory[v.toUpperCase()];
      if (fromCode && allowedSet.has(fromCode)) return fromCode;

      const alias = LEGACY_SERVICE_ALIASES[v.toUpperCase()] || LEGACY_SERVICE_ALIASES[v];
      if (alias && PROJECT_CATEGORIES.includes(alias) && allowedSet.has(alias)) return alias;

      return this._matchLabelFromUrl(v, allowedSet);
    },

    _resolveServiceCandidate(raw, allowedSet) {
      const v = String(raw || '').trim();
      if (!v) return null;
      if (allowedSet.has(v)) return v;

      const fromCode = this._urlCodeToService[v.toUpperCase()];
      if (fromCode && allowedSet.has(fromCode)) return fromCode;

      const alias = LEGACY_SERVICE_ALIASES[v.toUpperCase()] || LEGACY_SERVICE_ALIASES[v];
      if (alias && PROJECT_SERVICE_TYPES.includes(alias) && allowedSet.has(alias)) return alias;

      return this._matchLabelFromUrl(v, allowedSet);
    },

    _normalizeProject(project) {
      const category =
        project.category && PROJECT_CATEGORIES.includes(project.category)
          ? project.category
          : null;
      const service_types = Array.isArray(project.service_types)
        ? project.service_types.filter((t) => PROJECT_SERVICE_TYPES.includes(String(t || '').trim()))
        : [];
      return { ...project, category, service_types };
    },

    async init() {
      try {
        this.loading = true;
        const response = await fetch(this.projectsJsonUrl);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const raw = await response.json();
        const projects = (Array.isArray(raw) ? raw : []).map((p) => this._normalizeProject(p));

        this.allProjects = projects;
        this.filteredProjects = projects.slice();
        this._sortByDateDesc(this.filteredProjects);

        this._initUrlMaps();

        setTimeout(() => {
          this.applyUrlFilters();
          if (window.location.hash && window.location.hash.length > 1) {
            this.showFilters = true;
          }
          this.initSearchViewportFix();
        }, 0);

        this.loading = false;
      } catch (err) {
        console.error('Error loading projects:', err);
        this.error = 'Erro ao carregar projetos. Por favor, tente novamente mais tarde.';
        this.loading = false;
      }
    },

    _initUrlMaps() {
      const catMaps = buildServiceUrlMaps(this.availableCategories);
      this._categoryToUrlCode = catMaps.toCode;
      this._urlCodeToCategory = catMaps.fromCode;

      const svcMaps = buildServiceUrlMaps(this.availableServiceTypes);
      this._serviceToUrlCode = svcMaps.toCode;
      this._urlCodeToService = svcMaps.fromCode;
    },

    /**
     * Hash: #search=... opcional;
     *   - #category=FE (código) ou nome completo
     *   - #categories=FE,AC
     *   - #service=AR (código) ou nome completo (legado)
     *   - #services=AR,IN
     */
    applyUrlFilters() {
      if (!window.location.hash || window.location.hash.length <= 1) return;
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);

      const searchParam = params.get('search');
      if (searchParam) {
        this.searchTerm = this._unescapeUrlToken(searchParam);
      }

      const catBundled = params.get('categories');
      const catRepeated = params.getAll('category');
      const catCandidates = [];

      if (catBundled) {
        catBundled.split(/[|,]/).forEach((s) => {
          const t = s.trim();
          if (t) catCandidates.push(t);
        });
      }
      catRepeated.forEach((s) => {
        const t = (s || '').trim();
        if (t) catCandidates.push(t);
      });

      const catAllowed = new Set(this.availableCategories);
      const resolvedCats = [];
      const seenCats = new Set();
      catCandidates.forEach((c) => {
        const norm = this._resolveCategoryCandidate(c, catAllowed);
        if (norm && !seenCats.has(norm)) {
          seenCats.add(norm);
          resolvedCats.push(norm);
        }
      });
      this.selectedCategories = resolvedCats;

      const svcBundled = params.get('services');
      const svcRepeated = params.getAll('service');
      const svcCandidates = [];

      if (svcBundled) {
        svcBundled.split(/[|,]/).forEach((s) => {
          const t = s.trim();
          if (t) svcCandidates.push(t);
        });
      }
      svcRepeated.forEach((s) => {
        const t = (s || '').trim();
        if (t) svcCandidates.push(t);
      });

      const svcAllowed = new Set(this.availableServiceTypes);
      const resolvedSvcs = [];
      const seenSvcs = new Set();
      svcCandidates.forEach((c) => {
        const norm = this._resolveServiceCandidate(c, svcAllowed);
        if (norm && !seenSvcs.has(norm)) {
          seenSvcs.add(norm);
          resolvedSvcs.push(norm);
        }
      });
      this.selectedServiceTypes = resolvedSvcs;

      if (searchParam || catCandidates.length > 0 || svcCandidates.length > 0) {
        this.updateFilters();
      }
    },

    toggleCategory(category) {
      if (this.isCategorySelected(category)) {
        this.selectedCategories = this.selectedCategories.filter((s) => s !== category);
      } else {
        this.selectedCategories = [...this.selectedCategories, category];
      }
      this.updateFilters();
    },

    toggleServiceType(serviceType) {
      if (this.isServiceTypeSelected(serviceType)) {
        this.selectedServiceTypes = this.selectedServiceTypes.filter((s) => s !== serviceType);
      } else {
        this.selectedServiceTypes = [...this.selectedServiceTypes, serviceType];
      }
      this.updateFilters();
    },

    isCategorySelected(category) {
      return this.selectedCategories.includes(category);
    },

    isServiceTypeSelected(serviceType) {
      return this.selectedServiceTypes.includes(serviceType);
    },

    releaseFilterBtn(event) {
      const el = event?.currentTarget;
      if (el && typeof el.blur === 'function') {
        requestAnimationFrame(() => el.blur());
      }
    },

    initSearchViewportFix() {
      const input = document.getElementById('search-input');
      if (!input || input.dataset.viewportFixBound === '1') return;
      input.dataset.viewportFixBound = '1';

      const root = document.documentElement;
      const page = document.querySelector('.projects-page');

      const contain = () => {
        root.classList.add('projects-search-focused');
        if (page) page.classList.add('projects-search-focused');
      };
      const release = () => {
        root.classList.remove('projects-search-focused');
        if (page) page.classList.remove('projects-search-focused');
      };

      input.addEventListener('focus', contain);
      input.addEventListener('blur', release);
    },

    updateFilters() {
      let filtered = [...this.allProjects];

      if (this.searchTerm.trim()) {
        const searchLower = this.searchTerm.toLowerCase().trim();
        filtered = filtered.filter((project) => {
          return project.search_blob && project.search_blob.toLowerCase().includes(searchLower);
        });
      }

      if (this.selectedCategories.length > 0) {
        filtered = filtered.filter((project) => {
          return project.category && this.selectedCategories.includes(project.category);
        });
      }

      if (this.selectedServiceTypes.length > 0) {
        filtered = filtered.filter((project) => {
          if (!project.service_types || !Array.isArray(project.service_types)) {
            return false;
          }
          return this.selectedServiceTypes.some((selectedType) =>
            project.service_types.some(
              (projectType) => projectType && projectType.trim() === selectedType,
            ),
          );
        });
      }

      this._sortByDateDesc(filtered);
      this.filteredProjects = filtered;

      this.syncFiltersToUrl();
    },

    syncFiltersToUrl() {
      if (this.urlSyncTimer) {
        clearTimeout(this.urlSyncTimer);
      }

      this.urlSyncTimer = setTimeout(() => {
        const params = new URLSearchParams();

        if (this.searchTerm.trim()) {
          params.set('search', this.searchTerm.trim());
        }

        const cats = this.selectedCategories;
        const encCat = (label) => this._categoryToUrlCode[label] || label;

        if (cats.length === 1) {
          params.set('category', encCat(cats[0]));
        } else if (cats.length > 1) {
          params.set('categories', cats.map(encCat).join(','));
        }

        const types = this.selectedServiceTypes;
        const encSvc = (label) => this._serviceToUrlCode[label] || label;

        if (types.length === 1) {
          params.set('service', encSvc(types[0]));
        } else if (types.length > 1) {
          params.set('services', types.map(encSvc).join(','));
        }

        const newHash = params.toString();
        const newUrl = newHash ? `#${newHash}` : '';

        if (window.location.hash !== newUrl) {
          history.pushState(null, '', window.location.pathname + newUrl);
        }
      }, 300);
    },

    clearFilters() {
      this.searchTerm = '';
      this.selectedCategories = [];
      this.selectedServiceTypes = [];
      this.updateFilters();
      history.pushState(null, '', window.location.pathname);
    },

    hasActiveFilters() {
      return (
        this.searchTerm.trim() !== ''
        || this.selectedCategories.length > 0
        || this.selectedServiceTypes.length > 0
      );
    },
  };
}
