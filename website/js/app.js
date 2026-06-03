/**
 * app.js
 * FlopSource — Production Frontend
 *
 * Responsibilities:
 * - Load & manage data
 * - High-performance client-side filtering + sorting
 * - Render results grid with staggered card animations
 * - Dynamic filter pill controls
 * - Modal detail view
 * - Stats bar population
 */

(() => {
  'use strict';

  // ── STATE ──────────────────────────────────────────
  const state = {
    allData: [],
    filteredData: [],
    filters: {
      layerTypes:    new Set(),
      hardware:      new Set(),
      coolingTypes:  new Set(),
      jurisdictions: new Set()
    },
    searchTerm: '',
    comparisonSelection: new Set(),   // provider IDs selected for comparison
    lastComparisonUseCase: null,      // remembers the last Use Case chosen so AI re-runs on provider removal
    primaryUseCase: null              // NEW: Use Case filter on main page (sorts by Best In Class score)
  };

  // Expose state early so comparison.js and other modules can access it safely
  window.FlopSource = window.FlopSource || {};
  window.FlopSource.getState = () => state;

  // Safe wrapper for tray updates (function may live in comparison.js)
  function safeUpdateFloatingComparisonPanel() {
    if (window.FlopSourceComparison && typeof window.FlopSourceComparison.updateFloatingComparisonPanel === 'function') {
      window.FlopSourceComparison.updateFloatingComparisonPanel();
    } else if (typeof updateFloatingComparisonPanel === 'function') {
      updateFloatingComparisonPanel();
    }
  }

  // ── STATS BAR ──────────────────────────────────────
  function computeStats() {
    const total     = state.allData.length;
    const totalGPUs = state.allData.reduce((s, p) => s + (p.total_gpus || 0), 0);
    const clouds    = state.allData.filter(p => p.layer_type === 'GPU Cloud').length;
    const bare      = state.allData.filter(p => p.layer_type === 'Bare-Metal').length;
    const edge      = state.allData.filter(p => p.layer_type === 'Edge').length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('stat-providers', total);
    set('stat-gpus',      window.FlopSourceUtils?.formatLargeNumber?.(totalGPUs) || totalGPUs.toLocaleString());
    set('stat-cloud',     clouds);
    set('stat-baremetal', bare);
    set('stat-edge',      edge);
  }

  // ── FILTERING ENGINE (Pure) ────────────────────────
  function applyFilters(data, currentFilters, searchTerm) {
    const term = (searchTerm || '').toLowerCase().trim();

    return data.filter(provider => {
      if (currentFilters.layerTypes.size > 0 && !currentFilters.layerTypes.has(provider.layer_type)) return false;
      if (currentFilters.hardware.size > 0) {
        const hwArch = Array.isArray(provider.hardware_architectures) ? provider.hardware_architectures : (provider.hardware_architectures ? [provider.hardware_architectures] : []);
        const match = hwArch.some(h => currentFilters.hardware.has(h));
        if (!match) return false;
      }
      if (currentFilters.coolingTypes.size > 0 && !currentFilters.coolingTypes.has(provider.cooling_type)) return false;
      if (currentFilters.jurisdictions.size > 0 && !currentFilters.jurisdictions.has(provider.jurisdiction_zone)) return false;
      if (term.length > 1) {
        const hay = [provider.provider_name || '', provider.primary_location || ''].join(' ').toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }

  // ── RENDERING ──────────────────────────────────────
  function renderResults() {
    console.log('[FlopSource] renderResults called. Providers in state:', state.allData.length, '| Filtered:', state.filteredData.length);

    const grid      = document.getElementById('results-grid');
    const countEl   = document.getElementById('results-count');
    const emptyState = document.getElementById('empty-state');

    grid.innerHTML = '';
    countEl.textContent = state.filteredData.length;

    const headerCount = document.getElementById('provider-count-header');
    if (headerCount) headerCount.textContent = `${state.allData.length} providers`;

    if (state.filteredData.length === 0) {
      updateEmptyStateMessage();
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    const fragment = document.createDocumentFragment();

    state.filteredData.forEach((provider, index) => {
      let useCaseContext = null;

      if (state.primaryUseCase) {
        const scorer = (window.FlopSourceUtils && typeof window.FlopSourceUtils.computeProviderUseCaseScore === 'function')
          ? window.FlopSourceUtils.computeProviderUseCaseScore
          : null;

        if (scorer) {
          const score = scorer(provider, state.primaryUseCase);
          const uc = (window.FlopSourceUtils && typeof window.FlopSourceUtils.getUseCases === 'function')
            ? window.FlopSourceUtils.getUseCases()[state.primaryUseCase]
            : null;

          useCaseContext = {
            key: state.primaryUseCase,
            name: uc ? (uc.shortName || uc.name) : state.primaryUseCase,
            score: Math.round(score)
          };
        }
      }

      const card = Components.createProviderCard(provider, useCaseContext);
      // Stagger entrance animation
      card.style.animationDelay = `${Math.min(index * 40, 500)}ms`;

      // IMPORTANT: Ignore clicks on the Compare button so it never opens the detail modal.
      // The button only manages comparison selection state.
      card.addEventListener('click', (e) => {
        if (e.target.closest('.compare-btn')) return;
        openModal(provider);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target.closest('.compare-btn')) return;
          e.preventDefault();
          openModal(provider);
        }
      });

      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
    if (window.FlopSourceComparison && typeof window.FlopSourceComparison.syncCompareButtons === 'function') {
      window.FlopSourceComparison.syncCompareButtons();
    } else if (typeof syncCompareButtons === 'function') {
      syncCompareButtons();
    }
  }

  function updateActiveFilterSummary() {
    const container = document.getElementById('active-filters-summary');
    container.innerHTML = '';

    const total =
      state.filters.layerTypes.size +
      state.filters.hardware.size +
      state.filters.coolingTypes.size +
      state.filters.jurisdictions.size +
      (state.searchTerm.length > 1 ? 1 : 0) +
      (state.primaryUseCase ? 1 : 0);

    if (total === 0) {
      container.innerHTML = `<span style="font-size:0.68rem; color:var(--text-muted); padding:0 2px;">No active filters</span>`;
      return;
    }

    const chip = document.createElement('div');
    chip.className = 'active-chip';
    chip.innerHTML = `
      <span>${total} filter${total > 1 ? 's' : ''} active</span>
      <button class="active-chip-x" id="clear-from-summary" title="Clear all filters">
        <i class="fa-solid fa-times"></i>
      </button>
    `;
    chip.querySelector('#clear-from-summary').addEventListener('click', clearAllFilters);
    container.appendChild(chip);
  }

  // ── FILTER CONTROLS ────────────────────────────────
  function countsByField(field) {
    const counts = {};
    state.allData.forEach(d => { if (d[field]) counts[d[field]] = (counts[d[field]] || 0) + 1; });
    return counts;
  }

  function countsByArray(field) {
    const counts = {};
    state.allData.forEach(d => (d[field] || []).forEach(v => { counts[v] = (counts[v] || 0) + 1; }));
    return counts;
  }

  function initializeFilterControls() {
    const layerTypes   = [...new Set(state.allData.map(d => d.layer_type))].sort();
    const coolingTypes = [...new Set(state.allData.map(d => d.cooling_type))].sort();
    const jurisdictions = [...new Set(state.allData.map(d => d.jurisdiction_zone))].sort();

    const allHw = new Set();
    state.allData.forEach(d => {
      const hwArch = Array.isArray(d.hardware_architectures) ? d.hardware_architectures : (d.hardware_architectures ? [d.hardware_architectures] : []);
      hwArch.forEach(h => allHw.add(h));
    });
    const hardwareOptions = [...allHw].sort();

    const layerCounts   = countsByField('layer_type');
    const coolingCounts = countsByField('cooling_type');
    const jurisCounts   = countsByField('jurisdiction_zone');
    const hwCounts      = countsByArray('hardware_architectures');

    const layerContainer  = document.getElementById('filter-layer-type');
    const hardwareContainer = document.getElementById('filter-hardware');
    const coolingContainer  = document.getElementById('filter-cooling');
    const jurisContainer    = document.getElementById('filter-jurisdiction');

    layerContainer.appendChild(
      Components.createFilterSection('Layer Type',
        layerTypes.map(v => ({ value: v, label: v, count: layerCounts[v] || 0 })),
        (value, checked) => toggleFilter('layerTypes', value, checked)
      )
    );
    hardwareContainer.appendChild(
      Components.createFilterSection('Hardware',
        hardwareOptions.map(v => ({ value: v, label: v, count: hwCounts[v] || 0 })),
        (value, checked) => toggleFilter('hardware', value, checked)
      )
    );
    coolingContainer.appendChild(
      Components.createFilterSection('Cooling',
        coolingTypes.map(v => ({ value: v, label: v, count: coolingCounts[v] || 0 })),
        (value, checked) => toggleFilter('coolingTypes', value, checked)
      )
    );
    jurisContainer.appendChild(
      Components.createFilterSection('Jurisdiction',
        jurisdictions.map(v => ({ value: v, label: v, count: jurisCounts[v] || 0 })),
        (value, checked) => toggleFilter('jurisdictions', value, checked)
      )
    );

    // NEW: Use Case sorter (Best In Class ranking)
    renderPrimaryUseCaseFilter();
  }

  // ── EMPTY STATE ────────────────────────────────────
  function updateEmptyStateMessage() {
    const hintEl = document.getElementById('empty-state-hint');
    const suggestEl = document.getElementById('empty-state-suggestions');
    const clearSearchBtn = document.getElementById('empty-clear-search');
    if (!hintEl) return;

    const hasSearch = state.searchTerm.length > 1;
    const filterCount =
      state.filters.layerTypes.size +
      state.filters.hardware.size +
      state.filters.coolingTypes.size +
      state.filters.jurisdictions.size;
    const hasFilters = filterCount > 0 || !!state.primaryUseCase;

    // Show/hide "Clear search" button
    if (clearSearchBtn) clearSearchBtn.style.display = hasSearch ? '' : 'none';

    // Build a specific hint based on what's active
    if (hasSearch && hasFilters) {
      hintEl.textContent = `No providers match "${state.searchTerm}" with your ${filterCount + (state.primaryUseCase ? 1 : 0)} active filter${filterCount + (state.primaryUseCase ? 1 : 0) > 1 ? 's' : ''}. Try clearing the search or removing a filter.`;
    } else if (hasSearch) {
      hintEl.textContent = `No providers match "${state.searchTerm}". Check the spelling or try a provider name or location.`;
    } else if (state.primaryUseCase && filterCount > 0) {
      hintEl.textContent = `No providers match the selected Use Case and ${filterCount} filter${filterCount > 1 ? 's' : ''}. Try removing a filter.`;
    } else if (state.primaryUseCase) {
      hintEl.textContent = `No providers scored for the selected Use Case — the dataset may not have enough matching data yet.`;
    } else if (filterCount > 0) {
      hintEl.textContent = `No providers match all ${filterCount} active filter${filterCount > 1 ? 's' : ''}. Try removing one to broaden results.`;
    } else {
      hintEl.textContent = 'No providers available. Try refreshing data.';
    }

    // Populate suggestion chips — quick-pick common alternatives
    if (suggestEl) {
      suggestEl.innerHTML = '';
      if (hasSearch) {
        const tip = document.createElement('span');
        tip.style.cssText = 'font-size:0.72rem; color:var(--text-muted);';
        tip.textContent = 'Try searching: CoreWeave · Lambda Labs · Equinix · RunPod';
        suggestEl.appendChild(tip);
      }
    }
  }

  function toggleFilter(filterKey, value, isChecked) {
    if (isChecked) state.filters[filterKey].add(value);
    else state.filters[filterKey].delete(value);
    applyAndRender();
  }

  function clearAllFilters() {
    state.filters.layerTypes.clear();
    state.filters.hardware.clear();
    state.filters.coolingTypes.clear();
    state.filters.jurisdictions.clear();
    state.searchTerm = '';
    state.primaryUseCase = null;   // NEW

    // Reset pill buttons
    document.querySelectorAll('.f-pill').forEach(p => p.classList.remove('selected'));

    const searchInput = document.getElementById('global-search');
    if (searchInput) searchInput.value = '';

    applyAndRender();
    renderPrimaryUseCaseFilter(); // refresh the new pills
  }

  // ── PRIMARY USE CASE FILTER (Main Page) ────────────
  // Lets users sort the entire results grid by "Best In Class" score for a chosen workload type.
  function renderPrimaryUseCaseFilter() {
    const container = document.getElementById('filter-primary-use-case');
    if (!container) return;

    container.innerHTML = '';

    const useCases = (window.FlopSourceUtils && typeof window.FlopSourceUtils.getUseCases === 'function')
      ? window.FlopSourceUtils.getUseCases()
      : {};

    // "None" / Default option
    const noneBtn = document.createElement('button');
    noneBtn.className = `f-pill ${!state.primaryUseCase ? 'selected' : ''}`;
    noneBtn.textContent = 'Default';
    noneBtn.title = 'Default sorting (no use-case weighting)';
    noneBtn.onclick = () => {
      state.primaryUseCase = null;
      applyAndRender();
      renderPrimaryUseCaseFilter(); // re-render to update selected state
    };
    container.appendChild(noneBtn);

    Object.entries(useCases).forEach(([key, uc]) => {
      const btn = document.createElement('button');
      btn.className = `f-pill ${state.primaryUseCase === key ? 'selected' : ''}`;
      btn.textContent = uc.shortName || uc.name;
      btn.title = uc.description;

      btn.onclick = () => {
        if (state.primaryUseCase === key) {
          // Clicking the active one clears it
          state.primaryUseCase = null;
        } else {
          state.primaryUseCase = key;
        }
        applyAndRender();
        renderPrimaryUseCaseFilter();
      };

      container.appendChild(btn);
    });
  }

  // ── MODAL ──────────────────────────────────────────
  let currentModalProvider = null;

  function openModal(provider) {
    currentModalProvider = provider;

    const modal    = document.getElementById('modal');
    const nameEl   = document.getElementById('modal-provider-name');
    const locEl    = document.getElementById('modal-provider-location');
    const bodyEl   = document.getElementById('modal-body');

    nameEl.textContent = provider.provider_name;
    if (locEl) locEl.textContent = provider.primary_location || '';
    bodyEl.innerHTML = Components.renderModalContent(provider);

    const requestBtn = document.getElementById('modal-request-btn');
    if (requestBtn) {
      requestBtn.onclick = () => {
        const subject = encodeURIComponent(`Introduction request — ${provider.provider_name}`);
        const body = encodeURIComponent(`Hi,\n\nI'm interested in learning more about ${provider.provider_name} (${provider.primary_location}).\n\nProvider ID: ${provider.id}\n\nBest regards,`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      };
    }

    // Comparison toggle inside detail modal (convenience for enterprise workflow)
    const footerBar = requestBtn ? requestBtn.parentElement : null;
    if (footerBar) {
      // Remove any previous compare button to avoid duplicates on re-open
      const old = footerBar.querySelector('#modal-compare-btn');
      if (old) old.remove();

      const isSelected = state.comparisonSelection.has(provider.id);
      const cmpBtn = document.createElement('button');
      cmpBtn.id = 'modal-compare-btn';
      cmpBtn.className = isSelected ? 'btn-ghost' : 'btn-ghost';
      cmpBtn.style.marginRight = 'auto';
      cmpBtn.innerHTML = isSelected
        ? `<i class="fa-solid fa-check" style="margin-right:6px;"></i> In Comparison`
        : `<i class="fa-solid fa-columns" style="margin-right:6px;"></i> Add to Comparison`;

      cmpBtn.onclick = () => {
        toggleComparisonSelection(provider.id);
        // Update this button immediately
        const nowSelected = state.comparisonSelection.has(provider.id);
        cmpBtn.innerHTML = nowSelected
          ? `<i class="fa-solid fa-check" style="margin-right:6px;"></i> In Comparison`
          : `<i class="fa-solid fa-columns" style="margin-right:6px;"></i> Add to Comparison`;
        // Also keep main grid buttons in sync
        syncCompareButtons();
        safeUpdateFloatingComparisonPanel();
      };

      // Insert at start of footer so it sits left of Close/Request
      footerBar.insertBefore(cmpBtn, footerBar.firstChild);
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.addEventListener('keydown', handleModalEscape, { once: true });
  }

  function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    currentModalProvider = null;
  }

  function handleModalEscape(e) { if (e.key === 'Escape') closeModal(); }

  // ── SORTING + APPLY ────────────────────────────────
  function applyAndRender() {
    let filtered = applyFilters(state.allData, state.filters, state.searchTerm);

    const sortSelect = document.getElementById('sort-select');
    const sortMode = sortSelect ? sortSelect.value : 'name-asc';

    // NEW: If a Use Case is selected, sort primarily by Best In Class score for that use case.
    if (state.primaryUseCase) {
      const scorer = (window.FlopSourceUtils && typeof window.FlopSourceUtils.computeProviderUseCaseScore === 'function')
        ? window.FlopSourceUtils.computeProviderUseCaseScore
        : null;

      if (scorer) {
        // Pre-compute scores
        filtered.forEach(p => {
          p._useCaseScore = scorer(p, state.primaryUseCase);
        });

        filtered.sort((a, b) => {
          // Primary sort: higher use case score wins
          const scoreDiff = (b._useCaseScore || 0) - (a._useCaseScore || 0);
          if (Math.abs(scoreDiff) > 0.1) return scoreDiff;

          // Secondary sort: fall back to user-selected sort
          switch (sortMode) {
            case 'gpus-desc': return (b.total_gpus || 0) - (a.total_gpus || 0);
            case 'price-asc': {
              const pa = a.price_per_gpu_hour_usd ?? Infinity;
              const pb = b.price_per_gpu_hour_usd ?? Infinity;
              return pa - pb;
            }
            case 'verified-desc':
              return (b._verifiedTimestamp || 0) - (a._verifiedTimestamp || 0);
            case 'name-asc':
            default:
              return (a.provider_name || '').localeCompare(b.provider_name || '');
          }
        });
      }
    } else {
      // Normal sorting when no Use Case filter is active
      filtered.sort((a, b) => {
        switch (sortMode) {
          case 'gpus-desc':
            return (b.total_gpus || 0) - (a.total_gpus || 0);
          case 'price-asc': {
            const pa = a.price_per_gpu_hour_usd ?? Infinity;
            const pb = b.price_per_gpu_hour_usd ?? Infinity;
            return pa - pb;
          }
          case 'verified-desc': {
            // Uses pre-parsed timestamp for performance
            return (b._verifiedTimestamp || 0) - (a._verifiedTimestamp || 0);
          }
          case 'name-asc':
          default:
            return (a.provider_name || '').localeCompare(b.provider_name || '');
        }
      });
    }

    state.filteredData = filtered;
    renderResults();
    updateActiveFilterSummary();
  }

  // ── DATA LOADING ───────────────────────────────────
  async function loadData() {
    console.log('[FlopSource] Attempting to load data from ./data/data_centers.json');
    try {
      const res = await fetch('./data/data_centers.json');
      console.log('[FlopSource] Fetch response status:', res.status, res.ok ? '(OK)' : '(Failed)');

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const rawData = await res.json();
      console.log('[FlopSource] Raw data loaded. Type:', Array.isArray(rawData) ? 'array' : typeof rawData);

      if (Array.isArray(rawData)) {
        state.allData = rawData;
      } else if (rawData && Array.isArray(rawData.providers)) {
        state.allData = rawData.providers;
      } else {
        throw new Error('Unexpected data format - expected array or {providers: [...]}');
      }

      console.log('[FlopSource] Successfully loaded', state.allData.length, 'providers');

      // Normalize certain fields that should always be arrays (defensive against bad data)
      state.allData.forEach(p => {
        // hardware_architectures must be an array
        if (p.hardware_architectures && !Array.isArray(p.hardware_architectures)) {
          p.hardware_architectures = [p.hardware_architectures];
        } else if (!p.hardware_architectures) {
          p.hardware_architectures = [];
        }

        // certifications too, for safety
        if (p.certifications && !Array.isArray(p.certifications)) {
          p.certifications = [p.certifications];
        } else if (!p.certifications) {
          p.certifications = [];
        }

        // Pre-process dates for faster sorting
        if (p.last_verified) {
          const ts = Date.parse(p.last_verified);
          p._verifiedTimestamp = isNaN(ts) ? 0 : ts;
        } else {
          p._verifiedTimestamp = 0;
        }
      });

      state.filteredData = [...state.allData];
      return true;
    } catch (err) {
      console.error('[FlopSource] Data load error:', err);
      const grid = document.getElementById('results-grid');
      const isFileProtocol = window.location.protocol === 'file:';
      let hint = '';
      if (isFileProtocol) {
        hint = `<br><br><strong>Tip:</strong> You appear to be opening the file directly (file://). 
        This often blocks data loading.<br>
        Use <code>serve.bat</code> or <code>serve.ps1</code> in this folder instead, or run a local server.`;
      }
      grid.innerHTML = `
        <div class="col-span-full" style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); color:#f87171; padding:24px; border-radius:12px; font-size:0.85rem;">
          <strong>Unable to load provider data.</strong><br>
          Ensure <code>data/data_centers.json</code> exists and is valid JSON.
          ${hint}
        </div>
      `;
      return false;
    }
  }

  // ── INIT ───────────────────────────────────────────
  async function init() {
    const ok = await loadData();
    if (!ok) return;

    // Initial render
    state.filteredData = [...state.allData];
    renderResults();

    // Populate stats bar
    computeStats();

    // Build dynamic filter pills
    initializeFilterControls();

    // Wire up search
    const searchInput = document.getElementById('global-search');
    const handleSearch = debounce((e) => { state.searchTerm = e.target.value; applyAndRender(); }, 160);
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { searchInput.value = ''; state.searchTerm = ''; applyAndRender(); }
    });

    // "/" shortcut to focus search
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName === 'BODY') {
        e.preventDefault();
        searchInput?.focus();
      }
    });

    // Wire up clear / reset buttons
    document.getElementById('clear-filters')?.addEventListener('click', clearAllFilters);
    document.getElementById('reset-button')?.addEventListener('click', () => location.reload());

    // Theme toggle is now wired inside theme.js for better encapsulation.

    // Modal
    document.getElementById('modal-backdrop')?.addEventListener('click', closeModal);
    document.getElementById('modal-close-x')?.addEventListener('click', closeModal);
    document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);

    // Empty state clear
    document.getElementById('empty-clear-filters')?.addEventListener('click', clearAllFilters);
    document.getElementById('empty-clear-search')?.addEventListener('click', () => {
      const searchInput = document.getElementById('global-search');
      if (searchInput) searchInput.value = '';
      state.searchTerm = '';
      applyAndRender();
    });

    // Initial active filter summary
    updateActiveFilterSummary();

    // Sort change
    document.getElementById('sort-select')?.addEventListener('change', applyAndRender);

    // Refresh data link
    document.getElementById('refresh-data-link')?.addEventListener('click', async () => {
      const grid = document.getElementById('results-grid');
      grid.innerHTML = `<div class="col-span-full" style="padding:40px; text-align:center; color:var(--text-secondary); font-size:0.85rem;">Refreshing data…</div>`;
      const success = await loadData();
      if (success) {
        computeStats();
        ['filter-layer-type', 'filter-hardware', 'filter-cooling', 'filter-jurisdiction']
          .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
        initializeFilterControls();
        applyAndRender();
      }
    });

    // Expose debug helpers (merge to preserve early getState etc.)
    const exposed = {
      clearFilters: clearAllFilters,
      reload: () => location.reload(),
      theme: {
        get: getCurrentTheme,
        set: setTheme,
        toggle: toggleTheme
      },
      compare: {
        getSelected: () => Array.from(state.comparisonSelection),
        clear: () => window.FlopSourceComparison?.clearComparisonSelection?.(),
        show: showComparison,
        panel: () => window.FlopSourceComparison?.updateFloatingComparisonPanel?.(),
        toggle: (id, btn) => window.FlopSourceComparison?.toggleComparisonSelection?.(id, btn)
      },
      showComparison: showComparison,
      ai: window.FlopSourceAPI || {
        hasKey: () => false,
        setKey: () => {},
        clearKey: () => {},
        buildPrompt: () => ''
      }
    };
    Object.assign(window.FlopSource, exposed);

    // Make sure the comparison module can easily call showComparison from the tray
    window.FlopSourceComparison = window.FlopSourceComparison || {};

    console.log('%c[FlopSource] Ready. "/" = search  ·  Click logo to toggle light/dark theme  ·  Compare buttons build selection  ·  "c" opens full comparison', 'color:#00e59a');

    // Initialize modular systems
    if (window.FlopSourceComparison?.init) {
      window.FlopSourceComparison.init();
    }
    if (window.FlopSourceComparison?.syncCompareButtons) {
      window.FlopSourceComparison.syncCompareButtons();
    } else if (typeof syncCompareButtons === 'function') {
      syncCompareButtons();
    }

    // Permanent delegation for floating tray buttons.
    // Tray button listeners are now attached inside comparison.js (where the handler functions are defined).

    // Floating AI Consultation chatbot (bottom-right)
    if (window.FlopSourceAI && window.FlopSourceAI.init) {
      window.FlopSourceAI.init();
    } else if (typeof initFloatingAIConsultationWidget === 'function') {
      initFloatingAIConsultationWidget(); // fallback
    }
  }

  // ── COMPARISON SYSTEM (Enterprise Vendor Analysis) ─────────────────────────────
  // NOTE: initComparison has been moved to js/comparison.js for better modularity.
  // The rest of the comparison logic (tray, modal, scoring) is still being migrated.

  // Thin delegation layer so old code in app.js doesn't break during modularization
  function setCompareButtonState(btn, isSelected) {
    if (window.FlopSourceComparison && typeof window.FlopSourceComparison.setCompareButtonState === 'function') {
      return window.FlopSourceComparison.setCompareButtonState(btn, isSelected);
    }
    // Fallback local implementation
    if (!btn) return;
    const icon = '<i class="fa-solid fa-columns" style="font-size:0.7rem;"></i>';
    if (isSelected) {
      btn.innerHTML = `${icon}<span>Selected</span>`;
      btn.style.background = '#1e40af';
      btn.style.borderColor = '#1e40af';
      btn.style.color = 'white';
    } else {
      btn.innerHTML = `${icon}<span>Compare</span>`;
      btn.style.background = '#eff6ff';
      btn.style.borderColor = '#1e40af';
      btn.style.color = '#1e40af';
    }
  }

  function syncCompareButtons() {
    if (window.FlopSourceComparison && typeof window.FlopSourceComparison.syncCompareButtons === 'function') {
      return window.FlopSourceComparison.syncCompareButtons();
    }
    // local fallback if needed
  }

  function clearComparisonSelection() {
    if (window.FlopSourceComparison && typeof window.FlopSourceComparison.clearComparisonSelection === 'function') {
      return window.FlopSourceComparison.clearComparisonSelection();
    }
  }

  function toggleComparisonSelection(id, btnEl = null) {
    if (window.FlopSourceComparison && typeof window.FlopSourceComparison.toggleComparisonSelection === 'function') {
      return window.FlopSourceComparison.toggleComparisonSelection(id, btnEl);
    }
  }

  // Comparison logic is progressively moving into comparison.js.
  // The thin delegation functions above keep the rest of app.js working during the transition.

  // AI analysis logic lives in js/api.js
  // Access via window.FlopSourceAPI (available after api.js loads)

  function showComparison(preferredUseCase = null) {
    return window.FlopSourceComparison?.showComparison?.(preferredUseCase);
  }

  // ── AI Consultation (free-text) helpers ──────────────────────────────────────

  function showAIConsultationDialog(selected, aiInsightsContainer) {
    // Create a simple centered dialog
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.65);display:flex;align-items:center;justify-content:center;z-index:400;padding:20px;';

    const dialog = document.createElement('div');
    dialog.style.cssText = 'background:var(--bg-surface);border:1px solid var(--border-md);border-radius:14px;max-width:560px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.35);';

    dialog.innerHTML = `
      <div style="padding:18px 20px 14px; border-bottom:1px solid var(--border);">
        <div style="font-weight:600; font-size:0.95rem; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-comments"></i> AI Consultation
        </div>
        <div style="font-size:0.72rem; color:var(--text-secondary); margin-top:4px;">
          Describe your workload or requirements in your own words.
        </div>
      </div>
      <div style="padding:16px 20px;">
        <textarea id="consult-text" rows="5" placeholder="Example: We need ~180 H100s for fine-tuning a 70B model with strict EU data residency, strong uptime, and reasonable cost for burst workloads." style="
          width:100%; resize:vertical; font-family:inherit; font-size:0.85rem; line-height:1.4;
          padding:10px 12px; border:1px solid var(--border-md); border-radius:8px;
          background:var(--bg-inner); color:var(--text-primary);
        "></textarea>
        <div style="font-size:0.65rem; color:var(--text-muted); margin-top:6px;">
          The more specific you are (scale, latency needs, location, budget sensitivity, etc.), the better the recommendation.
        </div>
      </div>
      <div style="padding:12px 20px 16px; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:8px; background:var(--bg-inner);">
        <button id="consult-cancel" class="btn-ghost" style="font-size:0.8rem; padding:6px 14px;">Cancel</button>
        <button id="consult-run" class="btn" style="font-size:0.8rem; padding:6px 18px;">Run Analysis</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const textarea = dialog.querySelector('#consult-text');
    const cancelBtn = dialog.querySelector('#consult-cancel');
    const runBtn = dialog.querySelector('#consult-run');

    const closeDialog = () => overlay.remove();

    cancelBtn.onclick = closeDialog;

    runBtn.onclick = async () => {
      const userText = (textarea.value || '').trim();
      if (!userText) {
        textarea.style.borderColor = '#f87171';
        textarea.placeholder = 'Please describe your compute needs...';
        return;
      }
      closeDialog();

      // Show loading state in the insights area
      aiInsightsContainer.innerHTML = `
        <div style="border:1px solid var(--border-md); border-radius:10px; padding:14px 16px; background:var(--bg-inner);">
          <div style="display:flex; align-items:center; gap:8px; font-weight:600; color:var(--accent);">
            <i class="fa-solid fa-robot fa-spin"></i> Running AI consultation…
          </div>
        </div>
      `;

      try {
        const API = window.FlopSourceAPI || {};
        const prompt = API.buildConsultationPrompt
          ? API.buildConsultationPrompt(selected, userText)
          : 'Consultation prompt builder not available.';

        const analysis = await (API.generateAnalysis
          ? API.generateAnalysis(prompt)
          : Promise.reject(new Error('AI backend not configured')));

        // Render consultation result
        aiInsightsContainer.innerHTML = `
          <div style="border:1px solid var(--border-md); border-radius:10px; padding:14px 16px; background:var(--bg-surface);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div style="font-weight:600; display:flex; align-items:center; gap:8px; color:var(--accent);">
                <i class="fa-solid fa-comments"></i> AI Consultation
                <span style="font-size:0.65rem; opacity:0.6; font-weight:400;">(your requirements)</span>
              </div>
              <div style="display:flex; gap:6px;">
                <button class="consult-regenerate btn-ghost" style="font-size:0.7rem; padding:3px 8px;">Regenerate</button>
                <button class="consult-copy btn-ghost" style="font-size:0.7rem; padding:3px 8px;">Copy</button>
                <button class="consult-clear btn-ghost" style="font-size:0.7rem; padding:3px 8px; color:#f87171;">Clear</button>
              </div>
            </div>
            <div class="consult-result" style="font-size:0.86rem; line-height:1.45; white-space:pre-wrap; color:var(--text-primary);">
              ${escapeHTML(analysis)}
            </div>
          </div>
        `;

        const resultEl = aiInsightsContainer.querySelector('.consult-result');
        const regen = aiInsightsContainer.querySelector('.consult-regenerate');
        const copy = aiInsightsContainer.querySelector('.consult-copy');
        const clear = aiInsightsContainer.querySelector('.consult-clear');

        if (regen) regen.onclick = () => showAIConsultationDialog(selected, aiInsightsContainer);
        if (copy && resultEl) copy.onclick = async () => {
          await navigator.clipboard.writeText(resultEl.textContent);
          const orig = copy.textContent;
          copy.textContent = 'Copied!';
          setTimeout(() => { if (copy) copy.textContent = orig; }, 1400);
        };
        if (clear) clear.onclick = () => {
          aiInsightsContainer.style.display = 'none';
          aiInsightsContainer.innerHTML = '';
        };

      } catch (err) {
        console.error('[FlopSource] AI Consultation error:', err);
        aiInsightsContainer.innerHTML = `
          <div style="border:1px solid #f87171; border-radius:10px; padding:14px 16px; background:rgba(248,113,113,0.08); color:#f87171; font-size:0.85rem;">
            <strong>AI Consultation error:</strong> ${escapeHTML(err.message || 'Unknown error')}<br>
            <button class="consult-dismiss btn-ghost" style="margin-top:8px; font-size:0.75rem; padding:4px 10px;">Dismiss</button>
          </div>
        `;
        const dismiss = aiInsightsContainer.querySelector('.consult-dismiss');
        if (dismiss) dismiss.onclick = () => { aiInsightsContainer.style.display = 'none'; aiInsightsContainer.innerHTML = ''; };
      }
    };

    // Focus the textarea
    setTimeout(() => textarea.focus(), 50);
  }

  async function generateAndShowConsultation(container, selected, userDescription) {
    // This helper is available if we want to call consultation directly without the dialog
    const API = window.FlopSourceAPI || {};
    container.innerHTML = `
      <div style="border:1px solid var(--border-md); border-radius:10px; padding:14px 16px; background:var(--bg-inner);">
        <div style="display:flex; align-items:center; gap:8px; font-weight:600; color:var(--accent);">
          <i class="fa-solid fa-robot fa-spin"></i> Running AI consultation…
        </div>
      </div>
    `;

    try {
      const prompt = API.buildConsultationPrompt
        ? API.buildConsultationPrompt(selected, userDescription)
        : 'Prompt builder unavailable.';
      const analysis = await (API.generateAnalysis ? API.generateAnalysis(prompt) : Promise.reject(new Error('Backend not available')));

      container.innerHTML = `
        <div style="border:1px solid var(--border-md); border-radius:10px; padding:14px 16px; background:var(--bg-surface);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-weight:600; display:flex; align-items:center; gap:8px; color:var(--accent);">
              <i class="fa-solid fa-comments"></i> AI Consultation
            </div>
            <div style="display:flex; gap:6px;">
              <button class="consult-regenerate btn-ghost" style="font-size:0.7rem; padding:3px 8px;">Regenerate</button>
              <button class="consult-copy btn-ghost" style="font-size:0.7rem; padding:3px 8px;">Copy</button>
              <button class="consult-clear btn-ghost" style="font-size:0.7rem; padding:3px 8px; color:#f87171;">Clear</button>
            </div>
          </div>
          <div class="consult-result" style="font-size:0.86rem; line-height:1.45; white-space:pre-wrap;">
            ${escapeHTML(analysis)}
          </div>
        </div>
      `;

      // Wire buttons (simplified)
      const resultEl = container.querySelector('.consult-result');
      const regen = container.querySelector('.consult-regenerate');
      const copy = container.querySelector('.consult-copy');
      const clear = container.querySelector('.consult-clear');

      if (regen) regen.onclick = () => showAIConsultationDialog(selected, container);
      if (copy && resultEl) copy.onclick = async () => {
        await navigator.clipboard.writeText(resultEl.textContent);
        const orig = copy.textContent; copy.textContent = 'Copied!';
        setTimeout(() => { if (copy) copy.textContent = orig; }, 1400);
      };
      if (clear) clear.onclick = () => { container.style.display = 'none'; container.innerHTML = ''; };

    } catch (err) {
      container.innerHTML = `<div style="color:#f87171;font-size:0.85rem;">Error: ${escapeHTML(err.message)}</div>`;
    }
  }

  // Guidance modal when user clicks the top "AI Consultation" button with too few providers
  function showAIConsultationGuidance() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);display:flex;align-items:center;justify-content:center;z-index:400;padding:20px;';

    const box = document.createElement('div');
    box.style.cssText = 'background:var(--bg-surface);border:1px solid var(--border-md);border-radius:14px;max-width:420px;width:100%;padding:22px 24px;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

    box.innerHTML = `
      <div style="font-weight:600; font-size:1rem; display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <i class="fa-solid fa-comments" style="color:var(--accent);"></i> AI Consultation
      </div>
      <div style="font-size:0.85rem; color:var(--text-secondary); line-height:1.5; margin-bottom:16px;">
        To run a personalized AI consultation, first select <strong>2 or more providers</strong> from the list below.
        <br><br>
        Then click the <strong>AI Consultation</strong> button again (or open the comparison view).
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button id="guidance-close" class="btn-ghost" style="font-size:0.82rem; padding:7px 16px;">Got it</button>
        <button id="guidance-select" class="btn" style="font-size:0.82rem; padding:7px 16px;">Browse Providers</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    box.querySelector('#guidance-close').onclick = () => overlay.remove();

    box.querySelector('#guidance-select').onclick = () => {
      overlay.remove();
      // Scroll to the provider grid and give visual hint
      const grid = document.getElementById('provider-grid') || document.querySelector('.provider-grid');
      if (grid) {
        grid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        grid.style.transition = 'box-shadow 0.2s';
        grid.style.boxShadow = '0 0 0 3px rgba(56, 189, 248, 0.3)';
        setTimeout(() => {
          if (grid) grid.style.boxShadow = '';
        }, 1600);
      }
    };
  }

  function generateComparisonText(providers) {
    return window.FlopSourceComparison?.generateComparisonText?.(providers) || '';
  }
    // ── END COMPARISON SYSTEM ──────────────────────────────────────────────────────

  // Auto-start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
