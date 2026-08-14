/**
 * Home — botão "Carregar mais" do masonry.
 */
(function () {
  'use strict';

  function onLoadMore() {
    if (window.HomeMasonry && typeof window.HomeMasonry.loadMore === 'function') {
      window.HomeMasonry.loadMore();
    }
  }

  function init() {
    var more = document.getElementById('load-more-btn');
    if (more) {
      more.addEventListener('click', onLoadMore);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
