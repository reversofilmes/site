/**
 * Home — grid em colunas com empilhamento vertical + paginação "Carregar mais".
 *
 * Dois modos de layout:
 * - Editorial (desktop/tablet, filtro TODOS): colunas fixas do CMS (Liquid/home_col).
 *   Paginação por linhas sincronizadas — cada clique revela N linhas em todas as colunas.
 * - Greedy (mobile 2 col, ou filtro ativo): shortest-column só com itens visíveis.
 *
 * Ordem de revelação:
 * - TODOS + mobile: order ASC (desempate home_col)
 * - TODOS + desktop/tablet: raster das colunas originais
 * - filtrado: data desc
 */
var resizeTimeout = null;
var homeEntranceAnimationDone = false;

var GUTTER = 14;
var HOME_GRID_COLUMNS = 5;
var INITIAL_VISIBLE = 25;
var LOAD_STEP = 8;
/** Editorial (5 col): linhas visíveis por coluna — 5 linhas ≈ 25 cards */
var INITIAL_ROWS = 5;
var LOAD_STEP_ROWS = 2;
var HIDDEN = 'is-pack-hidden';

/** Desktop/tablet vs mobile — alinhar com CSS @media (max-width: 767px) */
var lastMobileLayout = null;
var lastResizeWidth = null;

function isMobileHomeGrid() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 767px)').matches;
}

var HOME_MOBILE_COLUMNS = 2;

function getEffectiveColumns() {
  return isMobileHomeGrid() ? HOME_MOBILE_COLUMNS : HOME_GRID_COLUMNS;
}

var state = {
  filter: '__all__',
  visibleRows: INITIAL_ROWS,
  visibleLimit: INITIAL_VISIBLE,
  columns: HOME_GRID_COLUMNS,
};

var gridEl = null;
var allItems = [];
var originalColumnItems = [];
var stabilizeTimerA = null;
var stabilizeTimerB = null;

/* ─── helpers ─── */

function clearStabilizeTimers() {
  if (stabilizeTimerA) clearTimeout(stabilizeTimerA);
  if (stabilizeTimerB) clearTimeout(stabilizeTimerB);
  stabilizeTimerA = null;
  stabilizeTimerB = null;
}

function stabilizeLayoutAfterInit() {
  clearStabilizeTimers();
  stabilizeTimerA = setTimeout(function () { relayoutKeepingState(); }, 220);
  stabilizeTimerB = setTimeout(function () { relayoutKeepingState(); }, 620);
}

function getContainerWidth(el) {
  var rect = el.getBoundingClientRect();
  return Math.max(rect.width || 0, el.clientWidth || 0);
}

function getGridTrackWidth(sizingEl) {
  if (!sizingEl) return 0;
  var wGrid = getContainerWidth(sizingEl);
  var parent = sizingEl.parentElement;
  if (parent && (parent.id === 'masonry-container' || (parent.classList && parent.classList.contains('masonry-container')))) {
    var st = getComputedStyle(parent);
    var pl = parseFloat(st.paddingLeft) || 0;
    var pr = parseFloat(st.paddingRight) || 0;
    var wInner = parent.getBoundingClientRect().width - pl - pr;
    return Math.max(0, Math.min(wGrid, wInner));
  }
  return wGrid;
}

function calculateColumnWidth(sizingEl) {
  var W = getGridTrackWidth(sizingEl);
  var cols = getEffectiveColumns();
  var gutterTotal = Math.max(0, cols - 1) * GUTTER;
  var col = (W - gutterTotal) / cols;
  var columnWidth = Math.max(1, Math.floor(col * 1000) / 1000);
  return { columnWidth: columnWidth, rowHeight: columnWidth, columns: cols };
}

/* ─── tamanho de itens ─── */

function parseSizeFromAttr(raw) {
  var s = String(raw || '1x1').toLowerCase().replace(/\s/g, '');
  // New aspect-ratio-based format system
  var heightMap = {
    '16x9': 9 / 16,
    '1x1': 1,
    '4x5': 5 / 4,
    '9x16': 16 / 9
  };
  if (heightMap[s] != null) return { w: 1, h: heightMap[s] };
  // Legacy formats
  if (s === '1x0.5' || s === '1x2' || s === '2x2') return { w: 1, h: 9 / 16 };
  if (s === '1x1.5' || s === '1x3') return { w: 1, h: 16 / 9 };
  if (s === '2x1') return { w: 1, h: 1 };
  // Fallback: try parsing numeric format
  var m = s.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (m) {
    var w = parseFloat(m[1]);
    var h = parseFloat(m[2]);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      return { w: 1, h: h / w };
    }
  }
  return { w: 1, h: 1 };
}

function parseSize(item) {
  return parseSizeFromAttr(item.getAttribute('data-size') || '1x1');
}

function getOrderValue(item) {
  var o = item.getAttribute('data-order');
  if (o == null || o === '') return 999999;
  var n = parseInt(String(o), 10);
  return Number.isFinite(n) ? n : 999999;
}

function getHomeColValue(item) {
  var c = item.getAttribute('data-home-col');
  var n = parseInt(String(c), 10);
  return Number.isFinite(n) ? n : 999;
}

function sizeItem(item, columnWidth, rowHeight, columns) {
  var s = parseSize(item);
  var cw = s.w > columns ? columns : s.w;
  item.style.width = (cw * columnWidth + (cw - 1) * GUTTER) + 'px';
  item.style.maxWidth = '100%';
  var extraGutters = s.h > 1 ? Math.floor(s.h - 1) * GUTTER : 0;
  item.style.height = (s.h * rowHeight + extraGutters) + 'px';
}

/* ─── serviços / filtro ─── */

function getServicesFromItem(item) {
  var raw = item.getAttribute('data-services');
  if (!raw || !raw.trim()) return [];
  try {
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(function (s) { return String(s).trim(); }) : [];
  } catch (e) {
    return [];
  }
}

function isFilterActive() {
  return state.filter !== '__all__';
}

function itemMatchesFilter(item) {
  if (!isFilterActive()) return true;
  var filters = state.filter;
  var services = getServicesFromItem(item);
  for (var i = 0; i < filters.length; i++) {
    if (services.indexOf(filters[i]) !== -1) return true;
  }
  return false;
}

/* ─── data (YYMMDD) ─── */

function getDateValue(item) {
  var raw = item.getAttribute('data-date') || '';
  if (raw.length === 6 && /^\d{6}$/.test(raw)) return parseInt(raw, 10) || 0;
  return 0;
}

/* ─── posições originais ─── */

function saveOriginalPositions() {
  var container = document.getElementById('masonry-container');
  if (!container) return;
  var cols = Array.from(container.querySelectorAll('.projects-col'));
  originalColumnItems = cols.map(function (col) {
    return Array.from(col.querySelectorAll('.project-item'));
  });
}

function restoreOriginalPositions() {
  var container = document.getElementById('masonry-container');
  if (!container) return;
  var cols = Array.from(container.querySelectorAll('.projects-col'));
  if (cols.length !== originalColumnItems.length) return;
  originalColumnItems.forEach(function (items, colIdx) {
    items.forEach(function (item) { cols[colIdx].appendChild(item); });
  });
}

/** Mobile + filtro “TODOS”: ordem global order ASC, desempate home_col ASC */
function sortMobileAllItems(items) {
  return items.slice().sort(function (a, b) {
    var oa = getOrderValue(a);
    var ob = getOrderValue(b);
    if (oa !== ob) return oa - ob;
    return getHomeColValue(a) - getHomeColValue(b);
  });
}

/** Ordem linha-a-linha das colunas originais (Liquid) — sequência de revelação no desktop/tablet. */
function getOriginalRasterOrder() {
  var cols = originalColumnItems;
  if (!cols.length) return [];
  var maxH = 0;
  cols.forEach(function (b) { if (b.length > maxH) maxH = b.length; });
  var out = [];
  for (var r = 0; r < maxH; r++) {
    for (var c = 0; c < HOME_GRID_COLUMNS; c++) {
      if (cols[c] && cols[c][r]) out.push(cols[c][r]);
    }
  }
  return out;
}

function getMatchingItemsSorted() {
  if (isFilterActive()) {
    return allItems.filter(itemMatchesFilter).sort(function (a, b) {
      var da = getDateValue(a);
      var db = getDateValue(b);
      if (db !== da) return db - da;
      return getOrderValue(a) - getOrderValue(b);
    });
  }
  if (isMobileHomeGrid()) {
    var flat = [];
    originalColumnItems.forEach(function (colItems) {
      colItems.forEach(function (item) { flat.push(item); });
    });
    return sortMobileAllItems(flat);
  }
  return getOriginalRasterOrder();
}

function layoutGreedy(items, numCols) {
  var container = document.getElementById('masonry-container');
  if (!container) return;
  var cols = Array.from(container.querySelectorAll('.projects-col'));
  if (!cols.length) return;
  var colHeights = [];
  for (var i = 0; i < numCols; i++) colHeights.push(0);
  items.forEach(function (item) {
    var minIdx = 0;
    for (var j = 1; j < numCols; j++) {
      if (colHeights[j] < colHeights[minIdx]) minIdx = j;
    }
    cols[minIdx].appendChild(item);
    colHeights[minIdx] += parseSize(item).h;
  });
}

/** Greedy só quando a grade não pode seguir as 5 colunas editoriais do CMS. */
function usesGreedyLayout() {
  return isMobileHomeGrid() || isFilterActive();
}

/** Itens visíveis no modo editorial: mesma profundidade (linhas) em cada coluna. */
function getEditorialVisibleItems(visibleRows) {
  var out = [];
  originalColumnItems.forEach(function (colItems) {
    var n = Math.min(visibleRows, colItems.length);
    for (var r = 0; r < n; r++) {
      out.push(colItems[r]);
    }
  });
  return out;
}

function isEditorialFullyVisible(visibleRows) {
  if (!originalColumnItems.length) return true;
  return originalColumnItems.every(function (colItems) {
    return visibleRows >= colItems.length;
  });
}

/** Desktop/tablet + TODOS: mantém home_col do CMS; só alterna visibilidade. */
function relayoutVisibleEditorial() {
  restoreOriginalPositions();
  var visible = getEditorialVisibleItems(state.visibleRows);
  var visibleSet = new Set(visible);
  allItems.forEach(function (item) {
    if (visibleSet.has(item)) {
      item.classList.remove(HIDDEN);
    } else {
      item.classList.add(HIDDEN);
    }
  });
  var loadMoreWrap = document.getElementById('load-more-wrap');
  if (loadMoreWrap) {
    loadMoreWrap.hidden = isEditorialFullyVisible(state.visibleRows);
  }
}

/** Redistribui só itens visíveis — mobile 2 col ou filtro ativo. */
function relayoutVisibleGreedy() {
  var matching = getMatchingItemsSorted();
  var visible = matching.slice(0, state.visibleLimit);
  var visibleSet = new Set(visible);
  allItems.forEach(function (item) {
    if (visibleSet.has(item)) {
      item.classList.remove(HIDDEN);
    } else {
      item.classList.add(HIDDEN);
    }
  });
  layoutGreedy(visible, getEffectiveColumns());
  var loadMoreWrap = document.getElementById('load-more-wrap');
  if (loadMoreWrap) {
    loadMoreWrap.hidden = state.visibleLimit >= matching.length;
  }
}

function relayoutVisible() {
  if (usesGreedyLayout()) {
    relayoutVisibleGreedy();
  } else {
    relayoutVisibleEditorial();
  }
}

/* ─── visibilidade (paginação) ─── */

function applyVisibilityClasses() {
  relayoutVisible();
}

function sizeVisibleItems() {
  var container = document.getElementById('masonry-container');
  if (!container) return;
  var grid = container.querySelector('.projects-grid');
  if (!grid) return;
  var dims = calculateColumnWidth(grid);
  state.columns = dims.columns;
  allItems.forEach(function (item) {
    if (!item.classList.contains(HIDDEN)) {
      sizeItem(item, dims.columnWidth, dims.rowHeight, dims.columns);
    }
  });
}

/* ─── animações ─── */

function killRunningTweens() {
  if (typeof gsap !== 'undefined' && allItems.length) {
    try { gsap.killTweensOf(allItems); } catch (_) {}
  }
}

function animateEntrance() {
  var visible = allItems.filter(function (el) { return !el.classList.contains(HIDDEN); });
  if (typeof gsap !== 'undefined') {
    gsap.fromTo(visible,
      { opacity: 0 },
      { opacity: 1, duration: 0.35, stagger: 0.035, ease: 'power2.out' }
    );
  } else {
    visible.forEach(function (item, i) {
      setTimeout(function () { item.style.opacity = '1'; }, i * 40);
    });
  }
}

function animateFilterTransition() {
  var visible = allItems.filter(function (el) { return !el.classList.contains(HIDDEN); });
  if (visible.length === 0) return;
  if (typeof gsap !== 'undefined') {
    gsap.fromTo(visible,
      { opacity: 0 },
      { opacity: 1, duration: 0.25, stagger: 0.02, ease: 'power2.out' }
    );
  } else {
    visible.forEach(function (item) { item.style.opacity = '1'; });
  }
}

/* ─── init / rebuild / resize ─── */

function runGridInit() {
  var container = document.getElementById('masonry-container');
  if (!container) return;
  var grid = container.querySelector('.projects-grid');
  if (!grid) return;
  container.classList.add('grid-enabled');
  grid.classList.add('visible');
  gridEl = grid;
  allItems = Array.from(container.querySelectorAll('.project-item'));

  saveOriginalPositions();
  lastMobileLayout = isMobileHomeGrid();
  lastResizeWidth = window.innerWidth;

  applyVisibilityClasses();
  if (allItems.length === 0) return;

  sizeVisibleItems();

  var visible = allItems.filter(function (el) { return !el.classList.contains(HIDDEN); });
  if (visible.length === 0) {
    container.style.minHeight = '0';
    return;
  }
  setTimeout(function () {
    if (!homeEntranceAnimationDone) {
      homeEntranceAnimationDone = true;
      animateEntrance();
    }
  }, 0);
}

function relayoutKeepingState() {
  sizeVisibleItems();
}

function handleResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(function () {
    var w = window.innerWidth;
    if (lastResizeWidth !== null && w === lastResizeWidth) return;
    lastResizeWidth = w;

    var nowMobile = isMobileHomeGrid();
    if (gridEl && lastMobileLayout !== null && lastMobileLayout !== nowMobile) {
      rebuildDomLayoutFromState();
    }
    lastMobileLayout = nowMobile;
    relayoutKeepingState();
  }, 200);
}

function rebuildDomLayoutFromState() {
  restoreOriginalPositions();
  applyVisibilityClasses();
  sizeVisibleItems();
}

function rebuildForFilter() {
  var container = document.getElementById('masonry-container');
  if (!container) return;
  if (!gridEl) { runGridInit(); return; }

  killRunningTweens();

  restoreOriginalPositions();
  applyVisibilityClasses();
  sizeVisibleItems();
  animateFilterTransition();
}

function initMasonry() {
  state.visibleRows = INITIAL_ROWS;
  state.visibleLimit = INITIAL_VISIBLE;
  state.filter = '__all__';
  allItems = [];
  originalColumnItems = [];
  homeEntranceAnimationDone = false;
  lastMobileLayout = null;
  clearStabilizeTimers();
  var container = document.getElementById('masonry-container');
  if (!container) return;
  window.removeEventListener('resize', handleResize);
  requestAnimationFrame(function () {
    runGridInit();
    window.addEventListener('resize', handleResize);
    stabilizeLayoutAfterInit();
  });
}

/* ─── API pública ─── */

function setFilter(svc) {
  clearStabilizeTimers();
  state.filter = svc || '__all__';
  state.visibleRows = INITIAL_ROWS;
  state.visibleLimit = INITIAL_VISIBLE;
  rebuildForFilter();
}

function loadMore() {
  clearStabilizeTimers();
  if (!document.getElementById('masonry-container')) return;

  if (usesGreedyLayout()) {
    state.visibleLimit += LOAD_STEP;
  } else {
    state.visibleRows += LOAD_STEP_ROWS;
  }

  if (!gridEl) { rebuildForFilter(); return; }

  var prevVisible = allItems.filter(function (el) { return !el.classList.contains(HIDDEN); });
  relayoutVisible();
  sizeVisibleItems();

  var newlyVisible = allItems.filter(function (el) {
    return !el.classList.contains(HIDDEN) && prevVisible.indexOf(el) === -1;
  });
  if (newlyVisible.length === 0) return;

  newlyVisible.forEach(function (item) { item.style.opacity = '0'; });
  if (typeof gsap !== 'undefined') {
    gsap.to(newlyVisible, {
      opacity: 1, duration: 0.35, stagger: 0.04, ease: 'power2.out',
    });
  } else {
    newlyVisible.forEach(function (item, i) {
      setTimeout(function () { item.style.opacity = '1'; }, i * 40);
    });
  }
}

window.HomeMasonry = { init: initMasonry, setFilter: setFilter, loadMore: loadMore };
window.initMasonry = initMasonry;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {});
}

window.addEventListener('load', function () {
  if (document.body.classList.contains('is-home')) {
    stabilizeLayoutAfterInit();
  }
}, { once: true });
