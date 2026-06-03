/**
 * comparison.js
 * FlopSource — Comparison System (Floating Tray + Full Modal + Scoring + AI inside modal)
 *
 * This module contains the entire enterprise comparison tool logic.
 * Extracted from app.js to reduce fragility and improve maintainability.
 *
 * Dependencies (loaded before this file):
 * - utils.js (for escapeHTML, derive*, getComparisonPalette, etc.)
 * - api.js (for FlopSourceAPI)
 */

(() => {
  'use strict';

  // The comparison system is still tightly coupled to the global `state` object
  // and several functions in app.js (renderResults, syncCompareButtons, etc.).
  // Full decoupling will require more work later.

  // ── COMPARISON SYSTEM (Enterprise Vendor Analysis) ─────────────────────────────

  function initComparison() {
    // Compare buttons rendered inside Components.createProviderCard
    // Event delegation keeps everything clean and survives re-renders
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.compare-btn');
      if (!btn) return;

      const id = btn.dataset.id;
      if (!id) return;

      // Toggle selection - use local function (now owned by this module)
      if (typeof toggleComparisonSelection === 'function') {
        toggleComparisonSelection(id, btn);
      } else {
        console.warn('[FlopSource] toggleComparisonSelection not available');
      }
    });

    // Keyboard support for comparison (press "c" when items are selected)
    document.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'c' && !e.target.matches('input, textarea')) {
        const count = (window.FlopSource && window.FlopSource.getSelected) 
          ? window.FlopSource.getSelected().length 
          : 0;
        if (count >= 2) {
          if (window.FlopSource && window.FlopSource.showComparison) {
            window.FlopSource.showComparison();
          } else if (typeof showComparison === 'function') {
            showComparison();
          }
        }
      }
    });
  }

  // Note: Many large functions (updateFloatingComparisonPanel, showComparison, 
  // renderComparisonTable, etc.) are still in app.js during this transition.
  // The goal of this file is to gradually become the home for all comparison logic.

  // ── Comparison Selection Core (moved here for proper ownership)
  function toggleComparisonSelection(id, btnEl = null) {
    const s = (window.FlopSource && typeof window.FlopSource.getState === 'function')
      ? window.FlopSource.getState()
      : null;

    if (!s || !s.comparisonSelection) {
      console.warn('[FlopSource] State not ready for comparison selection');
      return;
    }

    if (s.comparisonSelection.has(id)) {
      s.comparisonSelection.delete(id);
      if (btnEl) setCompareButtonState(btnEl, false);
    } else {
      if (s.comparisonSelection.size >= 10) {
        alert('Maximum 10 providers can be compared.');
        return;
      }
      s.comparisonSelection.add(id);
      if (btnEl) setCompareButtonState(btnEl, true);
    }

    if (typeof updateFloatingComparisonPanel === 'function') {
      updateFloatingComparisonPanel();
    }

    // If a comparison modal is currently open, refresh it
    const existing = document.getElementById('comparison-modal');
    if (existing) {
      existing.remove();
      if (s.comparisonSelection.size >= 2) {
        const showFn = (window.FlopSource && window.FlopSource.compare && window.FlopSource.compare.show) 
          ? window.FlopSource.compare.show 
          : (typeof showComparison === 'function' ? showComparison : null);
        if (showFn) showFn();
      }
    }
  }

  function syncCompareButtons() {
    const s = (window.FlopSource && typeof window.FlopSource.getState === 'function')
      ? window.FlopSource.getState()
      : null;

    document.querySelectorAll('.compare-btn').forEach(btn => {
      const id = btn.dataset.id;
      if (!id) return;
      const isSelected = s && s.comparisonSelection ? s.comparisonSelection.has(id) : false;
      if (typeof setCompareButtonState === 'function') {
        setCompareButtonState(btn, isSelected);
      }
    });
  }

  function clearComparisonSelection() {
    const s = (window.FlopSource && typeof window.FlopSource.getState === 'function')
      ? window.FlopSource.getState()
      : null;

    if (s && s.comparisonSelection) {
      s.comparisonSelection.clear();
    }
    if (typeof syncCompareButtons === 'function') syncCompareButtons();
    if (typeof updateFloatingComparisonPanel === 'function') updateFloatingComparisonPanel();
  }

  function setCompareButtonState(btn, isSelected) {
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

  // Expose everything comparison-related
  window.FlopSourceComparison = window.FlopSourceComparison || {};
  Object.assign(window.FlopSourceComparison, {
    init: initComparison,
    toggleComparisonSelection,
    syncCompareButtons,
    clearComparisonSelection,
    setCompareButtonState,   // exposed so app.js delegation works
  });

  // Also expose on the main FlopSource object for convenience/debugging (once it exists)
  function exposeToFlopSource() {
    if (window.FlopSource) {
      window.FlopSource.toggleComparisonSelection = toggleComparisonSelection;
      window.FlopSource.syncCompareButtons = syncCompareButtons;
      window.FlopSource.clearComparisonSelection = clearComparisonSelection;
    }
  }

  // Try immediately + after app.js likely ran
  exposeToFlopSource();
  setTimeout(exposeToFlopSource, 50);
  setTimeout(exposeToFlopSource, 200);

  // Global fallbacks for any remaining direct calls in app.js during transition
  window.toggleComparisonSelection = toggleComparisonSelection;
  window.syncCompareButtons = syncCompareButtons;
  window.clearComparisonSelection = clearComparisonSelection;
  window.setCompareButtonState = setCompareButtonState;

  // ─────────────────────────────────────────────────────────────────────────────
  // FLOATING TRAY SUBSYSTEM (historically the most fragile part of the UI)
  // Extracted here so listener and rebuild issues can be maintained in one place.
  // ─────────────────────────────────────────────────────────────────────────────

  let comparisonTray = null;
  let _trayRebuildInFlight = false;

  function makeDraggable(element, handle) {
    let offsetX = 0;
    let offsetY = 0;

    handle.onmousedown = function(e) {
      if (e.target.closest('button')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const rect = element.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;

      document.onmousemove = function(e) {
        e.preventDefault();
        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;

        const minLeft = 0;
        const minTop = 0;
        const maxLeft = window.innerWidth - element.offsetWidth;
        const maxTop = window.innerHeight - element.offsetHeight;

        newLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));
        newTop = Math.max(minTop, Math.min(newTop, maxTop));

        element.style.left = newLeft + 'px';
        element.style.top = newTop + 'px';
        element.style.bottom = 'auto';
        element.style.right = 'auto';
      };

      document.onmouseup = function() {
        document.onmousemove = null;
        document.onmouseup = null;
      };
    };
  }

  function handleTrayClick(e) {
    const tray = document.getElementById('comparison-tray');
    if (!tray || !tray.contains(e.target)) return;

    const compareBtn = e.target.closest('#tray-compare-btn');
    if (compareBtn) {
      e.stopPropagation();
      e.preventDefault();
      try {
        const showFn = (window.FlopSourceComparison && window.FlopSourceComparison.showComparison) ||
                       (window.FlopSource && window.FlopSource.showComparison) ||
                       (window.FlopSource && window.FlopSource.compare && window.FlopSource.compare.show) ||
                       (typeof showComparison === 'function' ? showComparison : null);

        if (showFn) {
          showFn();
        } else {
          console.warn('[FlopSource] Could not find showComparison function from tray (delegation)');
        }
      } catch (err) {
        console.error('[FlopSource] Error opening comparison from tray button:', err);
        // This catch block exists because the "Compare Providers" button from the floating tray
        // has historically been extremely fragile to any refactor in app.js (scope, TDZ,
        // category shape mismatches between display vs pure-scoring objects, etc.).
        // The real fix lives in app.js (guards + strict separation of renderCategories vs scoringCategories).
      }
      return;
    }

    const removeBtn = e.target.closest('.tray-remove-btn');
    if (removeBtn) {
      e.stopPropagation();
      const id = removeBtn.dataset.id;
      if (!id) return;

      const s = (window.FlopSource && typeof window.FlopSource.getState === 'function')
        ? window.FlopSource.getState()
        : null;

      if (s && s.comparisonSelection) {
        s.comparisonSelection.delete(id);
      }
      if (typeof syncCompareButtons === 'function') syncCompareButtons();
      if (typeof updateFloatingComparisonPanel === 'function') updateFloatingComparisonPanel();

      const fullModal = document.getElementById('comparison-modal');
      if (fullModal) {
        if (s && s.comparisonSelection && s.comparisonSelection.size < 2) {
          fullModal.remove();
        } else {
          // Provider removed from tray while modal was open and still has >=2 providers.
          // Reopen the modal with the last chosen use case so AI analysis automatically re-runs.
          fullModal.remove();
          const lastUc = (s && s.lastComparisonUseCase) || null;
          if (typeof showComparison === 'function') {
            showComparison(lastUc);
          } else if (window.FlopSource && typeof window.FlopSource.showComparison === 'function') {
            window.FlopSource.showComparison(lastUc);
          }
        }
      }
      return;
    }

    const clearBtn = e.target.closest('#tray-clear-all');
    if (clearBtn) {
      e.stopPropagation();
      const bigModal = document.getElementById('comparison-modal');
      if (bigModal) bigModal.remove();
      if (typeof clearComparisonSelection === 'function') clearComparisonSelection();
      return;
    }
  }

  function handleTrayMouseDown(e) {
    const tray = document.getElementById('comparison-tray');
    if (!tray || !tray.contains(e.target)) return;

    if (e.target.closest('#tray-clear-all')) {
      e.stopPropagation();
    }
  }

  function updateFloatingComparisonPanel() {
    if (_trayRebuildInFlight) return;
    _trayRebuildInFlight = true;

    try {
      const s = (window.FlopSource && typeof window.FlopSource.getState === 'function')
        ? window.FlopSource.getState()
        : null;

      const count = (s && s.comparisonSelection) ? s.comparisonSelection.size : 0;

      if (count < 2) {
        if (comparisonTray) comparisonTray.style.display = 'none';
        return;
      }

      const p = (window.FlopSourceUtils && typeof window.FlopSourceUtils.getComparisonPalette === 'function')
        ? window.FlopSourceUtils.getComparisonPalette()
        : (typeof getComparisonPalette === 'function' ? getComparisonPalette() : {
            trayBg: '#1e293b', trayBorder: '#38bdf8', headerBg: '#0b1120', headerBorder: '#334155',
            headerText: '#38bdf8', listBg: '#1e293b', itemText: '#f8fafc', itemSub: '#94a3b8',
            removeBg: 'rgba(248,113,113,0.15)', removeColor: '#f87171', footerBg: '#0f172a',
            footerBorder: '#334155', compareBtnBg: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
            compareBtnColor: '#0f172a', countBg: '#38bdf8', countColor: '#0f172a', dragHint: 'rgba(56,189,248,0.6)'
          });

      if (!comparisonTray) {
        comparisonTray = document.createElement('div');
        comparisonTray.id = 'comparison-tray';
        comparisonTray.style.cssText = [
          'position:fixed',
          'bottom:24px',
          'right:24px',
          'width:320px',
          `background:${p.trayBg}`,
          `border:2px solid ${p.trayBorder}`,
          'border-radius:12px',
          'box-shadow:0 16px 48px rgba(15,23,42,0.22)',
          'z-index:210',
          'font-size:0.82rem',
          'overflow:hidden'
        ].join(';');

        document.body.appendChild(comparisonTray);
      } else {
        comparisonTray.style.background = p.trayBg;
        comparisonTray.style.border = `2px solid ${p.trayBorder}`;
      }

      comparisonTray.style.display = 'block';

      const selected = (s && s.allData)
        ? Array.from(s.comparisonSelection || [])
            .map(id => s.allData.find(p => p.id === id))
            .filter(Boolean)
        : [];

      let html = `
        <div id="tray-header" style="background:${p.headerBg}; border-bottom:1px solid ${p.headerBorder}; padding:8px 12px; display:flex; align-items:center; gap:10px; font-weight:600; color:${p.headerText}; user-select:none; cursor:move;" title="Click and drag anywhere on this bar to move the panel">
          <div style="display:flex; align-items:center; color:${p.dragHint}; opacity:0.7; flex-shrink:0;">
            <i class="fa-solid fa-grip-vertical" style="font-size:1rem; pointer-events:none;"></i>
          </div>
          <div style="flex:1; display:flex; align-items:center; gap:6px; min-width:0;">
            <span>Selected for Comparison</span>
            <span style="background:${p.countBg}; color:${p.countColor}; font-size:0.68rem; padding:1px 6px; border-radius:999px; flex-shrink:0;">${count}/10</span>
          </div>
          <button id="tray-clear-all" title="Clear all selections" 
                  style="background:${p.removeBg}; border:1px solid ${p.removeColor}33; color:${p.removeColor}; font-size:0.7rem; padding:3px 10px; border-radius:4px; cursor:pointer; flex-shrink:0; font-weight:500;">
            Clear
          </button>
        </div>
        <div id="tray-list" style="max-height:160px; overflow:auto; padding:6px 4px 4px; background:${p.listBg};">
      `;

      selected.forEach(pv => {
        html += `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:5px 10px; border-radius:6px; margin:2px 4px;">
            <div style="min-width:0; flex:1;">
              <div style="font-weight:600; color:var(--text-primary); font-size:0.82rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(pv.provider_name)}</div>
              <div style="font-size:0.65rem; color:var(--text-secondary);">${escapeHTML(pv.layer_type)} · ${escapeHTML(pv.primary_location || '')}</div>
            </div>
            <button class="tray-remove-btn" data-id="${pv.id}" title="Remove from selection"
                    style="width:22px; height:22px; border:none; background:${p.removeBg}; color:${p.removeColor}; border-radius:4px; font-size:13px; line-height:1; cursor:pointer; flex-shrink:0;">×</button>
          </div>
        `;
      });

      html += `</div>`;

      html += `
        <div style="padding:10px 12px; background:${p.footerBg}; border-top:1px solid ${p.footerBorder};">
          <button id="tray-compare-btn"
                  class="btn-primary"
                  style="width:100%; padding:9px 14px; font-size:0.85rem; font-weight:600; background:${p.compareBtnBg}; color:${p.compareBtnColor}; border:none; border-radius:9px; cursor:pointer;">
            Compare Providers
          </button>
        </div>
      `;

      comparisonTray.innerHTML = html;

      const header = comparisonTray.querySelector('#tray-header');
      if (header) {
        makeDraggable(comparisonTray, header);
      }

      // We no longer attach a direct click listener to #tray-compare-btn here.
      // All tray buttons (including Compare Providers) are now handled exclusively
      // by the document-level delegation in handleTrayClick (attached once from this module).
      // This eliminates the previous dual-path fragility.
      // The cloneNode step below is no longer strictly needed for this button,
      // but we keep a lightweight version in case other code attaches listeners.
      const compareBtn = comparisonTray.querySelector('#tray-compare-btn');
      if (compareBtn) {
        // Strip any potential stale listeners from previous tray versions
        const freshBtn = compareBtn.cloneNode(true);
        compareBtn.parentNode.replaceChild(freshBtn, compareBtn);
        // No custom listener attached — delegation handles it.
      }
    } catch (err) {
      console.error('[FlopSource] Error during tray rebuild:', err);
    } finally {
      _trayRebuildInFlight = false;
    }
  }

  // Expose tray functions
  Object.assign(window.FlopSourceComparison, {
    updateFloatingComparisonPanel,
    makeDraggable,
  });

  // Also keep global fallbacks during transition
  window.updateFloatingComparisonPanel = updateFloatingComparisonPanel;

  // Attach document-level delegation for tray buttons.
  // This must live inside this module so the handler functions are in scope.
  // These listeners are lightweight (they early-return if the click isn't inside the tray).
  document.addEventListener('click', handleTrayClick, false);
  document.addEventListener('mousedown', handleTrayMouseDown, false);

  console.log('%c[FlopSource] Comparison tray button delegation attached (from comparison.js)', 'color:#22c55e');

  // ─────────────────────────────────────────────────────────────────────────────
  // FULL COMPARISON MODAL (moved from app.js)
  // Owns the enterprise side-by-side view: use-case selector, AI analysis,
  // Best In Class highlights, and Save/Share export.
  // ─────────────────────────────────────────────────────────────────────────────

  function showComparison(preferredUseCase = null) {
    // Lead-gen gate: after the user has completed 3 comparisons, prompt for email
    // before showing the 4th. Gate is checked BEFORE recording so it fires on attempt 4+, not 3.
    const gate = window.FlopSourceLeadGate;
    if (gate) {
      if (typeof gate.shouldPromptEmailForComparison === 'function' &&
          gate.shouldPromptEmailForComparison()) {
        // Show the shared email grabber first. When they submit, re-invoke
        // showComparison — the second time the gate check will pass because they now have an email.
        gate.requireThen(() => showComparison(preferredUseCase));
        return;
      }

      // Record the attempt only after passing the gate check.
      if (typeof gate.recordComparisonUse === 'function') {
        gate.recordComparisonUse();
      }
    }

    const st = window.FlopSource.getState();
    if (!st) { console.error('[FlopSource] showComparison: state not available'); return; }

    let selected = Array.from(st.comparisonSelection)
      .map(id => st.allData.find(p => p.id === id))
      .filter(Boolean);

    // Use Case definitions live in utils.js (single source of truth)
    const useCases = window.FlopSourceUtils.getUseCases();

    let currentUseCase = preferredUseCase || st.lastComparisonUseCase || 'balanced';
    if (!useCases[currentUseCase]) currentUseCase = 'balanced';
    st.lastComparisonUseCase = currentUseCase;

    const isRestoringPreviousUseCase = !!preferredUseCase;

    function getSortedProvidersForUseCase(providers, useCaseKey) {
      const uc = useCases[useCaseKey];
      if (!uc || typeof computeProviderScores !== 'function') return [...providers];
      const { scored } = computeProviderScores(providers, uc);
      return scored.map(sc => sc.provider);
    }

    selected = getSortedProvidersForUseCase(selected, currentUseCase);

    let currentAiRanking = null;

    const attachRemoveListeners = (container) => {
      container.querySelectorAll('.cmp-remove-col').forEach(btn => {
        btn.onclick = (ev) => {
          ev.stopPropagation();
          const id = btn.dataset.id;
          if (!id) return;
          const previousUseCase = st.lastComparisonUseCase;
          st.comparisonSelection.delete(id);
          modal.remove();
          syncCompareButtons();
          updateFloatingComparisonPanel();
          if (st.comparisonSelection.size >= 2) {
            showComparison(previousUseCase);
          }
        };
      });
    };

    // Display category descriptors — MUST have both .get(p) and .getScore(p).
    // Never pass pure scoring descriptors from utils.js createScoringCategories() here.
    const categories = [
      {
        label: 'Reliability & Uptime',
        get: window.deriveReliability || deriveReliability,
        getScore: (p) => p.sla_uptime_percent || 0,
        higherIsBetter: true,
        bestLabel: 'Most reliable'
      },
      {
        label: 'Cost Efficiency',
        get: window.deriveCost || deriveCost,
        getScore: (p) => 50,
        higherIsBetter: true,
        bestLabel: 'Best value'
      },
      {
        label: 'Scalability',
        get: window.deriveScalability || deriveScalability,
        getScore: (p) => p.total_gpus || 0,
        higherIsBetter: true,
        bestLabel: 'Best scale'
      },
      {
        label: 'High Performance',
        get: window.derivePerformance || derivePerformance,
        getScore: (p) => {
          const hwArch = Array.isArray(p.hardware_architectures) ? p.hardware_architectures : (p.hardware_architectures ? [p.hardware_architectures] : []);
          const hw = hwArch.join(' ').toLowerCase();
          if (hw.includes('h200')) return 100;
          if (hw.includes('h100')) return 90;
          if (hw.includes('mi300')) return 80;
          if (hw.includes('a100')) return 70;
          if (hw.includes('l40')) return 60;
          return 30;
        },
        higherIsBetter: true,
        bestLabel: 'Highest performance'
      },
      {
        label: 'Energy Efficiency',
        get: window.deriveEnergy || deriveEnergy,
        getScore: (p) => {
          const c = (p.cooling_type || '').toLowerCase();
          if (c.includes('immersion')) return 100;
          if (c.includes('liquid')) return 80;
          if (c.includes('hybrid')) return 50;
          return 20;
        },
        higherIsBetter: true,
        bestLabel: 'Most efficient'
      }
    ];

    if (!categories || categories.length !== 5 || typeof categories[0].get !== 'function') {
      console.error('[FlopSource] showComparison: CRITICAL — categories missing .get() methods. Aborting.');
      return;
    }

    const prev = document.getElementById('comparison-modal');
    if (prev) prev.remove();

    const modal = document.createElement('div');
    modal.id = 'comparison-modal';
    const overlayBg = getCurrentTheme() === 'dark' ? 'rgba(15,23,42,0.82)' : 'rgba(15,23,42,0.55)';
    modal.style.cssText = `position:fixed;inset:0;background:${overlayBg};backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:300;padding:16px;`;

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--bg-surface);border:1px solid var(--border-md);border-radius:16px;max-width:1180px;width:100%;max-height:92vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(15,23,42,0.25);';

    const headerBg = getCurrentTheme() === 'dark' ? '#0f172a' : '#fff';
    const header = document.createElement('div');
    header.style.cssText = `padding:16px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:${headerBg};border-radius:16px 16px 0 0;`;
    header.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <div>
          <div style="font-size:1.05rem;font-weight:700;letter-spacing:-0.02em;color:var(--text-primary);">Provider Comparison</div>
          <div style="font-size:0.72rem;color:var(--text-secondary);margin-top:1px;">${selected.length} providers · Enterprise analysis view</div>
        </div>
      </div>
      <button id="cmp-close-x" class="modal-close-btn" style="width:34px;height:34px;"><i class="fa-solid fa-times"></i></button>
    `;

    const body = document.createElement('div');
    body.style.cssText = 'padding:18px 22px;overflow:auto;flex:1;';

    const useCaseContainer = document.createElement('div');
    useCaseContainer.style.cssText = 'margin-bottom:14px;';
    const isDarkForUC = getCurrentTheme() === 'dark';
    useCaseContainer.innerHTML = `
      <div style="font-size:0.72rem; font-weight:600; color:var(--text-secondary); margin-bottom:6px;">
        Use Case (changes value scoring &amp; recommendations)
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:6px;" id="use-case-selector">
        ${Object.entries(useCases).map(([key, uc]) => {
          const shouldShowActive = key === currentUseCase;
          return `
            <button data-usecase="${key}" class="use-case-btn ${shouldShowActive ? 'active' : ''}" style="
              padding:4px 12px;
              font-size:0.72rem;
              border:1px solid ${shouldShowActive ? 'var(--accent)' : 'var(--border-md)'};
              background: ${shouldShowActive ? 'var(--accent-glow)' : (isDarkForUC ? '#1e293b' : '#fff')};
              color: ${shouldShowActive ? 'var(--accent)' : 'var(--text-secondary)'};
              border-radius:6px;
              cursor:pointer;
              font-weight:500;
            ">
              ${uc.name}
            </button>
          `;
        }).join('')}
      </div>
      <div id="use-case-description" style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">
        ${useCases[currentUseCase].description}
      </div>
    `;
    body.appendChild(useCaseContainer);

    const explanation = document.createElement('div');
    explanation.id = 'recommendation-explanation';
    explanation.style.cssText = 'margin-bottom:12px;font-size:0.75rem;color:var(--text-secondary);';
    explanation.innerHTML = `
      <strong>Recommendation logic:</strong> Before selecting a Use Case the table shows <strong>pure numeric Best In Class</strong> (most unique category wins + overall score tie-breaker).
      After you pick a use case the AI analysis runs and its declared <strong>#1 becomes Best In Class</strong>, with visible 2nd &amp; 3rd runner-up highlights.
    `;
    body.appendChild(explanation);

    const aiInsightsContainer = document.createElement('div');
    aiInsightsContainer.id = 'ai-insights';
    aiInsightsContainer.style.cssText = 'margin: 12px 0 20px;';
    aiInsightsContainer.innerHTML = `
      <div style="border:1px dashed var(--border-md); border-radius:10px; padding:18px 20px; background:var(--bg-inner); text-align:center; color:var(--text-secondary); font-size:0.9rem;">
        <i class="fa-solid fa-robot" style="margin-right:8px; color:var(--accent);"></i>
        Select a <strong>Use Case</strong> above to automatically generate an AI-powered analysis tailored to your priorities.
      </div>
    `;
    body.appendChild(aiInsightsContainer);

    const useCaseButtons = useCaseContainer.querySelectorAll('.use-case-btn');
    const descriptionEl  = useCaseContainer.querySelector('#use-case-description');

    useCaseButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        currentUseCase = btn.dataset.usecase;
        st.lastComparisonUseCase = currentUseCase;
        const nowDark = getCurrentTheme() === 'dark';
        currentAiRanking = null;
        selected = getSortedProvidersForUseCase(selected, currentUseCase);

        useCaseButtons.forEach(b => {
          const isActive = b.dataset.usecase === currentUseCase;
          b.classList.toggle('active', isActive);
          b.style.border      = isActive ? '1px solid var(--accent)' : '1px solid var(--border-md)';
          b.style.background  = isActive ? 'var(--accent-glow)' : (nowDark ? '#1e293b' : '#fff');
          b.style.color       = isActive ? 'var(--accent)' : 'var(--text-secondary)';
        });

        if (descriptionEl) {
          descriptionEl.textContent  = useCases[currentUseCase].description;
          descriptionEl.style.fontStyle = 'normal';
        }

        if (window._flopComparisonTableContainer) {
          window._flopComparisonTableContainer.innerHTML = renderComparisonTable(selected, currentUseCase);
          attachRemoveListeners(window._flopComparisonTableContainer);
        }

        try {
          generateAndShowAiAnalysis(aiInsightsContainer, selected, currentUseCase, categories, useCases);
        } catch (aiErr) {
          console.error('[FlopSource] Auto AI analysis on use-case change failed:', aiErr);
        }
      });
    });

    if (isRestoringPreviousUseCase) {
      useCaseButtons.forEach(b => {
        const isActive = b.dataset.usecase === currentUseCase;
        b.classList.toggle('active', isActive);
        const nowDark = getCurrentTheme() === 'dark';
        b.style.border     = isActive ? '1px solid var(--accent)' : '1px solid var(--border-md)';
        b.style.background = isActive ? 'var(--accent-glow)' : (nowDark ? '#1e293b' : '#fff');
        b.style.color      = isActive ? 'var(--accent)' : 'var(--text-secondary)';
      });
      if (descriptionEl) {
        descriptionEl.textContent  = useCases[currentUseCase].description;
        descriptionEl.style.fontStyle = 'normal';
      }
      try { updateComparisonHighlights(currentUseCase); } catch (e) { console.error('[FlopSource] Restore highlights failed:', e); }
      try { generateAndShowAiAnalysis(aiInsightsContainer, selected, currentUseCase, categories, useCases); } catch (e) { console.error('[FlopSource] Auto re-run AI after removal failed:', e); }
    }

    // Reusable table renderer — rebuilds entirely when use case changes
    function renderComparisonTable(providers, useCaseKey) {
      if (!Array.isArray(categories) || typeof categories[0]?.get !== 'function') {
        console.error('[FlopSource] renderComparisonTable: corrupted categories.');
        return '<div style="padding:20px;color:#f87171">Comparison table could not render. Please reload.</div>';
      }

      const uc      = useCases[useCaseKey];
      const weights = uc.weights;

      const renderCategories = categories.map(cat => {
        if (cat.label === 'Cost Efficiency') {
          return {
            ...cat,
            getScore: (p) => (p.price_per_gpu_hour_usd != null
              ? 100 - Math.min(p.price_per_gpu_hour_usd, 10) * 8
              : (uc.costBaselineForQuote || 55))
          };
        }
        return cat;
      });

      const scoringResult = (window.computeProviderScores || computeProviderScores)
        ? (window.computeProviderScores || computeProviderScores)(providers, uc)
        : null;

      const scores = scoringResult
        ? scoringResult.scored.map(s => ({ provider: s.provider, totalScore: s.overallScore }))
        : providers.map(provider => {
            let total = 0;
            renderCategories.forEach((cat, i) => {
              total += Math.max(0, Math.min(100, cat.getScore(provider))) * weights[i];
            });
            return { provider, totalScore: total };
          });
      if (!scoringResult) scores.sort((a, b) => b.totalScore - a.totalScore);

      const bestAnalysis = (window.computeBestInClass || computeBestInClass)
        ? (window.computeBestInClass || computeBestInClass)(providers, uc)
        : null;

      const bestCounts           = bestAnalysis ? bestAnalysis.bestCounts           : {};
      const highlyRecommendedId  = bestAnalysis ? bestAnalysis.highlyRecommendedId  : null;
      const highlyRecommendedCount = bestAnalysis ? bestAnalysis.highlyRecommendedCount : 0;

      if (!bestAnalysis) {
        const fbBestCounts = {};
        providers.forEach(p => { fbBestCounts[p.id] = 0; });
        renderCategories.forEach(cat => {
          const sfc = providers.map(p => ({ provider: p, score: cat.getScore(p) }));
          const mx  = Math.max(...sfc.map(s => s.score));
          const wins = sfc.filter(s => s.score === mx);
          if (wins.length === 1) fbBestCounts[wins[0].provider.id]++;
        });
        const mbc = Math.max(0, ...Object.values(fbBestCounts));
        let topIds = Object.entries(fbBestCounts).filter(([,c]) => c === mbc && c > 0).map(([id]) => id);
        if (topIds.length > 1) {
          for (const s of scores) { if (topIds.includes(s.provider.id)) { topIds = [s.provider.id]; break; } }
        }
        Object.assign(bestCounts, fbBestCounts);
      }

      let html = `<div style="overflow-x:auto;"><table style="width:100%;min-width:720px;border-collapse:collapse;font-size:0.82rem;">`;

      html += `<tr style="border-bottom:2px solid var(--border-strong);">`;
      html += `<th style="text-align:left;padding:10px 12px 10px 4px;width:168px;color:var(--text-secondary);font-weight:600;font-size:0.68rem;letter-spacing:0.06em;">CATEGORY</th>`;

      providers.forEach(p => {
        const site = p.website ? `href="${p.website}" target="_blank" rel="noopener"` : '';
        const isHighlyRecommended = p.id === highlyRecommendedId;
        const thStyle = isHighlyRecommended
          ? 'text-align:left;padding:8px 10px;min-width:168px;border-left:1px solid var(--border);background:#eff6ff;'
          : 'text-align:left;padding:8px 10px;min-width:168px;border-left:1px solid var(--border);';
        html += `
          <th style="${thStyle}" data-provider-id="${p.id}">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;">
              <a ${site} style="font-weight:600;color:var(--text-primary);font-size:0.9rem;line-height:1.15;text-decoration:none;">
                ${escapeHTML(p.provider_name)}
              </a>
              <button class="cmp-remove-col" data-id="${p.id}" title="Remove from comparison"
                      style="width:18px;height:18px;border:none;background:rgba(15,23,42,0.06);color:var(--text-secondary);border-radius:4px;font-size:10px;cursor:pointer;line-height:1;">×</button>
            </div>
            <div style="font-size:0.62rem;color:var(--text-muted);margin-top:2px;">${escapeHTML(p.layer_type)}</div>
            <div class="recommended-badge" data-provider-id="${p.id}" style="margin-top:4px; display:${isHighlyRecommended ? 'inline-block' : 'none'}; font-size:0.65rem;background:#1e40af;color:white;padding:2px 6px;border-radius:3px;font-weight:600;">
              ★ Best In Class Score ${highlyRecommendedCount}/${categories.length}
            </div>
          </th>`;
      });
      html += `</tr>`;

      renderCategories.forEach(cat => {
        if (typeof cat.get !== 'function') {
          console.error('[FlopSource] renderComparisonTable: category missing .get()', cat);
          return;
        }
        const scoresForCat = providers.map(p => ({ provider: p, score: cat.getScore(p) }));
        const maxScore = Math.max(...scoresForCat.map(s => s.score));
        const providersWithMaxScore = scoresForCat.filter(s => s.score === maxScore);
        const hasUniqueBest = providersWithMaxScore.length === 1;
        const uniqueBestId  = hasUniqueBest ? providersWithMaxScore[0].provider.id : null;

        html += `<tr style="border-bottom:1px solid var(--border);" data-category="${cat.label}">`;
        html += `<td style="padding:11px 12px 11px 4px;font-weight:600;color:var(--text-secondary);white-space:nowrap;font-size:0.78rem;">${cat.label}</td>`;

        providers.forEach(p => {
          const val    = cat.get(p);
          const isBest = hasUniqueBest && p.id === uniqueBestId;
          let cellStyle = 'padding:11px 10px;border-left:1px solid var(--border);vertical-align:top;color:var(--text-primary);';
          let badge = '';
          if (isBest) {
            const bh = getBestHighlightStyle();
            cellStyle += bh.cell;
            badge = bh.badge;
          }
          html += `<td data-provider-id="${p.id}" style="${cellStyle}">${val}${badge}</td>`;
        });
        html += `</tr>`;
      });

      html += `<tr style="background:var(--bg-inner);">`;
      html += `<td style="padding:9px 12px 9px 4px;font-size:0.72rem;font-weight:600;color:var(--text-secondary);">Key Metrics</td>`;
      providers.forEach(p => {
        const gpus = p.total_gpus ? p.total_gpus.toLocaleString() + ' GPUs' : '—';
        const loc  = escapeHTML(p.primary_location || '');
        html += `<td style="padding:9px 10px;border-left:1px solid var(--border);font-size:0.78rem;line-height:1.3;color:var(--text-primary);">${gpus}<br><span style="color:var(--text-muted);font-size:0.7rem;">${loc}</span></td>`;
      });
      html += `</tr>`;
      html += `</table></div>`;
      return html;
    }

    function updateComparisonHighlights(useCaseKey) {
      if (!window._flopComparisonTableContainer) return;
      const container = window._flopComparisonTableContainer;
      const uc = useCases[useCaseKey];

      const ai = (currentAiRanking && currentAiRanking.useCase === useCaseKey) ? currentAiRanking : null;

      if (ai && ai.primaryId) {
        container.querySelectorAll('.recommended-badge').forEach(el => {
          const pid = el.dataset.providerId;
          if (pid === ai.primaryId) {
            el.style.display    = 'inline-block';
            el.textContent      = `★ AI Recommended (for ${uc.name})`;
            el.style.background = 'linear-gradient(90deg, #3b82f6, #1e40af)';
          } else {
            el.style.display = 'none';
          }
        });

        const maskFor = (pid) => {
          if (pid === ai.primaryId) return (window.getAiColumnMaskStyle || getAiColumnMaskStyle)(1);
          if (pid === ai.secondId)  return (window.getAiColumnMaskStyle || getAiColumnMaskStyle)(2);
          if (pid === ai.thirdId)   return (window.getAiColumnMaskStyle || getAiColumnMaskStyle)(3);
          return (window.getAiColumnMaskStyle || getAiColumnMaskStyle)('other');
        };

        selected.map(p => p.id).forEach(pid => {
          const mask      = maskFor(pid);
          const isPrimary = pid === ai.primaryId;
          const hdr = container.querySelector(`th[data-provider-id="${pid}"]`);
          if (hdr) {
            hdr.style.background = mask.background || '';
            if (mask.borderLeft) hdr.style.borderLeft = mask.borderLeft;
            hdr.style.filter = mask.filter || '';
            if (isPrimary) hdr.style.boxShadow = 'inset 4px 0 0 var(--accent)';
          }
          container.querySelectorAll(`td[data-provider-id="${pid}"]`).forEach(td => {
            td.style.background = mask.background || '';
            if (mask.borderLeft) td.style.borderLeft = mask.borderLeft;
            td.style.filter = mask.filter || '';
            if (isPrimary) td.style.boxShadow = 'inset 4px 0 0 var(--accent)';
            if (pid !== ai.primaryId && pid !== ai.secondId && pid !== ai.thirdId) {
              td.style.color = 'var(--text-muted)';
            }
          });
        });
        return;
      }

      // Fallback: pure numeric highlighting
      const bestAnalysis = (window.computeBestInClass || computeBestInClass)
        ? (window.computeBestInClass || computeBestInClass)(selected, uc)
        : null;

      const numericRenderCategories = categories.map(cat => {
        if (cat.label === 'Cost Efficiency') {
          return { ...cat, getScore: (p) => (p.price_per_gpu_hour_usd != null ? 100 - Math.min(p.price_per_gpu_hour_usd, 10) * 8 : (uc.costBaselineForQuote || 55)) };
        }
        return cat;
      });

      const categoryWinners      = bestAnalysis ? bestAnalysis.categoryWinners      : {};
      const highlyRecommendedId  = bestAnalysis ? bestAnalysis.highlyRecommendedId  : null;
      const highlyRecommendedCount = bestAnalysis ? bestAnalysis.highlyRecommendedCount : 0;

      container.querySelectorAll('.recommended-badge').forEach(el => {
        const pid = el.dataset.providerId;
        if (pid === highlyRecommendedId) {
          el.style.display = 'inline-block';
          el.textContent   = `★ Best In Class Score ${highlyRecommendedCount}/${categories.length}`;
        } else {
          el.style.display = 'none';
        }
      });

      numericRenderCategories.forEach(cat => {
        const row = container.querySelector(`tr[data-category="${cat.label}"]`);
        if (!row) return;
        if (typeof cat.getScore !== 'function') { console.error('[FlopSource] updateComparisonHighlights: missing getScore', cat); return; }

        const winnerId = categoryWinners[cat.label] || null;
        row.querySelectorAll('td[data-provider-id]').forEach(td => {
          const pid      = td.dataset.providerId;
          const isWinner = pid === winnerId;
          td.style.background  = '';
          td.style.borderLeft  = '1px solid var(--border)';
          td.style.fontWeight  = '';
          const oldBadge = td.querySelector('.best-badge');
          if (oldBadge) oldBadge.remove();
          if (isWinner) {
            const bh = getBestHighlightStyle();
            const bgMatch     = /background:([^;]+)/.exec(bh.cell);
            const borderMatch = /border:([^;]+)/.exec(bh.cell);
            td.style.background = bgMatch     ? bgMatch[1]     : '#dbeafe';
            td.style.borderLeft = borderMatch ? borderMatch[1] : '2px solid #2563eb';
            td.style.fontWeight = '500';
            const badge = document.createElement('span');
            badge.className  = 'best-badge';
            badge.style.cssText = `font-size:0.7rem;color:${bh.badgeText || '#1e40af'};font-weight:700;background:#bfdbfe;padding:1px 5px;border-radius:3px;margin-left:6px;`;
            badge.textContent = '★ BEST IN CLASS';
            td.appendChild(badge);
          }
        });
      });
    }

    // Defined inside showComparison so it closes over currentAiRanking, selected, etc.
    async function generateAndShowAiAnalysis(container, selected, useCaseKey, categories, useCases) {
      const API = window.FlopSourceAPI || {};
      container.innerHTML = `
        <div style="border:1px solid var(--border-md); border-radius:10px; padding:14px 16px; background:var(--bg-inner);">
          <div style="display:flex; align-items:center; gap:8px; font-weight:600; color:var(--accent);">
            <i class="fa-solid fa-robot fa-spin"></i> Running AI analysis…
          </div>
        </div>
      `;
      try {
        const prompt   = API.buildAnalysisPrompt  ? API.buildAnalysisPrompt(selected, useCaseKey, categories, useCases) : 'Unable to build prompt';
        const analysis = await (API.generateAnalysis ? API.generateAnalysis(prompt) : Promise.reject(new Error('AI backend not configured yet')));

        let displayAnalysis = analysis;
        const rankingLineMatch = analysis.match(/^\s*AI\s*RANKING\s*:.*$/im);
        if (rankingLineMatch) displayAnalysis = analysis.replace(rankingLineMatch[0], '').trim();

        container.innerHTML = `
          <div style="border:1px solid var(--border-md); border-radius:10px; padding:14px 16px; background:var(--bg-surface);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div style="font-weight:600; display:flex; align-items:center; gap:8px; color:var(--accent);">
                <i class="fa-solid fa-robot"></i> AI Analysis <span style="font-size:0.65rem; opacity:0.6; font-weight:400;">(use-case: ${useCases[useCaseKey].name})</span>
              </div>
              <div style="display:flex; gap:6px;">
                <button class="ai-regenerate btn-ghost" style="font-size:0.7rem; padding:3px 8px;">Regenerate</button>
                <button class="ai-copy btn-ghost" style="font-size:0.7rem; padding:3px 8px;">Copy</button>
                <button class="ai-clear btn-ghost" style="font-size:0.7rem; padding:3px 8px; color:#f87171;">Clear</button>
              </div>
            </div>
            <div class="ai-result" style="font-size:0.86rem; line-height:1.45; white-space:pre-wrap; color:var(--text-primary);">
              ${escapeHTML(displayAnalysis)}
            </div>
          </div>
        `;

        try {
          const parser = window.parseAiRanking || parseAiRanking;
          const parsed = parser ? parser(analysis, selected) : null;
          if (parsed && parsed.primaryId) {
            currentAiRanking = { useCase: useCaseKey, ...parsed, rawAnalysis: analysis };
            if (window._flopComparisonTableContainer) updateComparisonHighlights(useCaseKey);
          } else {
            currentAiRanking = null;
          }
        } catch (parseErr) {
          console.warn('[FlopSource] Could not parse AI RANKING:', parseErr);
          currentAiRanking = null;
        }

        const regenerateBtn = container.querySelector('.ai-regenerate');
        const copyBtn       = container.querySelector('.ai-copy');
        const clearBtn      = container.querySelector('.ai-clear');
        const resultEl      = container.querySelector('.ai-result');

        if (regenerateBtn) regenerateBtn.onclick = async () => { await generateAndShowAiAnalysis(container, selected, useCaseKey, categories, useCases); };
        if (copyBtn) copyBtn.onclick = async () => {
          await navigator.clipboard.writeText(resultEl.textContent);
          const orig = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { if (copyBtn) copyBtn.textContent = orig; }, 1400);
        };
        if (clearBtn) clearBtn.onclick = () => {
          currentAiRanking = null;
          container.style.display = 'none';
          container.innerHTML = '';
          try { updateComparisonHighlights(useCaseKey); } catch (e) { /* ignore */ }
        };
      } catch (err) {
        console.error('[FlopSource] AI Analysis error:', err);
        container.innerHTML = `
          <div style="border:1px solid #f87171; border-radius:10px; padding:14px 16px; background:rgba(248,113,113,0.08); color:#f87171; font-size:0.85rem;">
            <strong>AI Analysis error:</strong> ${escapeHTML(err.message || 'Unknown error')}<br>
            <button class="ai-clear btn-ghost" style="margin-top:8px; font-size:0.75rem; padding:4px 10px;">Dismiss</button>
          </div>
        `;
        const dismiss = container.querySelector('.ai-clear');
        if (dismiss) dismiss.onclick = () => { container.style.display = 'none'; container.innerHTML = ''; };
      }
    }

    // Initial table render
    const initialTableHTML = renderComparisonTable(selected, currentUseCase);
    const tableContainer   = document.createElement('div');
    tableContainer.innerHTML = initialTableHTML;
    body.appendChild(tableContainer);
    window._flopComparisonTableContainer = tableContainer;

    const footer   = document.createElement('div');
    const footerBg = getCurrentTheme() === 'dark' ? '#0f172a' : '#fff';
    footer.style.cssText = `padding:14px 22px;border-top:1px solid var(--border);background:${footerBg};border-radius:0 0 16px 16px;display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap;`;
    footer.innerHTML = `
      <button id="cmp-share-btn" class="btn-primary" style="font-size:0.82rem;padding:8px 18px;">
        <i class="fa-solid fa-clipboard" style="margin-right:6px;font-size:0.8rem;"></i>Save / Share
      </button>
      <button id="cmp-clear-btn" class="btn-ghost" style="font-size:0.8rem;padding:8px 16px;">Clear Selection</button>
      <button id="cmp-close-btn" class="btn-ghost" style="font-size:0.8rem;padding:8px 16px;">Close</button>
    `;

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(footer);
    modal.appendChild(panel);
    document.body.appendChild(modal);

    const closeDetailed = () => {
      modal.remove();
      updateFloatingComparisonPanel();
    };

    header.querySelector('#cmp-close-x').onclick = closeDetailed;
    footer.querySelector('#cmp-close-btn').onclick = closeDetailed;
    modal.onclick = (e) => { if (e.target === modal) closeDetailed(); };

    footer.querySelector('#cmp-clear-btn').onclick = () => {
      modal.remove();
      st.lastComparisonUseCase = null;
      clearComparisonSelection();
    };

    footer.querySelector('#cmp-share-btn').onclick = () => {
      const text = generateComparisonText(selected);
      navigator.clipboard.writeText(text).then(() => {
        const orig = footer.querySelector('#cmp-share-btn').innerHTML;
        footer.querySelector('#cmp-share-btn').innerHTML = 'Copied!';
        setTimeout(() => {
          if (footer.querySelector('#cmp-share-btn')) footer.querySelector('#cmp-share-btn').innerHTML = orig;
        }, 1400);
      }).catch(() => {
        prompt('Copy this comparison for your vendor analysis:', text);
      });
    };

    attachRemoveListeners(body);

    const esc = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', esc);
        closeDetailed();
      }
    };
    document.addEventListener('keydown', esc, { once: true });
  }

  function generateComparisonText(providers) {
    const lines = [];
    lines.push('FlopSource — AI Compute Provider Comparison');
    lines.push('Generated for internal enterprise vendor analysis');
    lines.push(`Date: ${new Date().toISOString().slice(0,10)}`);
    lines.push(`Providers compared: ${providers.length}`);
    lines.push('');
    lines.push('═'.repeat(72));

    providers.forEach((p, i) => {
      lines.push('');
      lines.push(`${i+1}. ${p.provider_name}`);
      if (p.website) lines.push(`   Homepage: ${p.website}`);
      lines.push(`   Type: ${p.layer_type}  |  Location: ${p.primary_location || '—'}`);
      lines.push(`   GPUs: ${p.total_gpus ? p.total_gpus.toLocaleString() : 'N/A'}`);
      lines.push('');
      lines.push('   Enterprise Priorities:');
      lines.push(`     Reliability & Uptime : ${(window.deriveReliability || deriveReliability)(p)}`);
      lines.push(`     Cost Efficiency      : ${(window.deriveCost || deriveCost)(p)}`);
      lines.push(`     Scalability          : ${(window.deriveScalability || deriveScalability)(p)}`);
      lines.push(`     High Performance     : ${(window.derivePerformance || derivePerformance)(p)}`);
      lines.push(`     Energy Efficiency    : ${(window.deriveEnergy || deriveEnergy)(p)}`);
      if (p.notes) {
        lines.push('');
        lines.push(`   Notes: ${p.notes}`);
      }
      lines.push('');
      lines.push('   ─'.repeat(34));
    });

    lines.push('');
    lines.push('Next steps: Visit the listed homepages or request intros via FlopSource.');
    lines.push('Source: FlopSource AI Compute Directory (flopsource.com)');
    return lines.join('\n');
  }

  Object.assign(window.FlopSourceComparison, { showComparison, generateComparisonText });
  window.showComparison = showComparison;
  window.generateComparisonText = generateComparisonText;

})();