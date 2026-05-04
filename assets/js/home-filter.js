/**
 * Filtro de serviços na Home — apenas um tipo ativo por vez (+ “TODOS”).
 * Carregar mais — pagination do masonry.
 */
(function () {
  'use strict';

  /** null = todos os serviços */
  var selectedService = null;

  function getButtons() {
    return document.querySelectorAll('#home-filter .projects-filter__btn[data-service]');
  }

  function syncButtonStyles() {
    var isAll = selectedService === null;
    getButtons().forEach(function (btn) {
      var svc = btn.getAttribute('data-service');
      if (svc === '__all__') {
        btn.classList.toggle('projects-filter__btn--active', isAll);
      } else {
        btn.classList.toggle('projects-filter__btn--active', svc === selectedService);
      }
    });
  }

  function onFilterClick(e) {
    var btn = e.target.closest('.projects-filter__btn[data-service]');
    if (!btn) return;
    e.preventDefault();

    var service = btn.getAttribute('data-service') || '__all__';

    if (service === '__all__') {
      selectedService = null;
    } else {
      if (selectedService === service) {
        selectedService = null;
      } else {
        selectedService = service;
      }
    }

    syncButtonStyles();

    try {
      btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    } catch (_) {
      btn.scrollIntoView();
    }

    if (window.HomeMasonry && typeof window.HomeMasonry.setFilter === 'function') {
      var filterValue =
        selectedService === null ? '__all__' : [selectedService];
      window.HomeMasonry.setFilter(filterValue);
    }
  }

  function onLoadMore() {
    if (window.HomeMasonry && typeof window.HomeMasonry.loadMore === 'function') {
      window.HomeMasonry.loadMore();
    }
  }

  function init() {
    var filter = document.getElementById('home-filter');
    if (filter) {
      filter.addEventListener('click', onFilterClick);
    }
    var more = document.getElementById('load-more-btn');
    if (more) {
      more.addEventListener('click', onLoadMore);
    }
    syncButtonStyles();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
