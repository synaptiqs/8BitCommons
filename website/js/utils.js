/**
 * utils.js
 * Pure / reusable utilities for FlopSource.
 * No side effects on global state or heavy DOM assumptions.
 */

(() => {
  'use strict';

  window.FlopSourceUtils = window.FlopSourceUtils || {};

  // ─────────────────────────────────────────────
  // Basic utilities
  // ─────────────────────────────────────────────
  function debounce(fn, delay = 180) {
    let timer = null;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  }

  function safeValue(val, fallback = 'Not disclosed') {
    return (val === null || val === undefined || val === '' || val === 'Unknown') ? fallback : val;
  }

  // Simple HTML escaping to mitigate XSS when using innerHTML with external data
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Format large numbers with K / M / B / T suffixes.
   * Examples:
   *   950 → "950"
   *   1200 → "1.2K"
   *   1_002_550 → "1M"
   *   1_450_000_000 → "1.5B"
   */
  function formatLargeNumber(num, { decimals = 1 } = {}) {
    if (num == null || isNaN(num)) return '—';

    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';

    if (abs < 1000) {
      return sign + Math.round(abs);
    }

    const units = [
      { threshold: 1_000_000_000_000, suffix: 'T' },
      { threshold: 1_000_000_000,     suffix: 'B' },
      { threshold: 1_000_000,         suffix: 'M' },
      { threshold: 1_000,             suffix: 'K' },
    ];

    for (const unit of units) {
      if (abs >= unit.threshold) {
        const value = abs / unit.threshold;
        const rounded = value >= 10 
          ? Math.round(value) 
          : value.toFixed(decimals);
        return sign + rounded + unit.suffix;
      }
    }

    return sign + Math.round(abs);
  }

  // Expose publicly
  window.FlopSourceUtils.formatLargeNumber = formatLargeNumber;

  // ─────────────────────────────────────────────
  // Scoring helpers (pure)
  // ─────────────────────────────────────────────
  function deriveScalability(p) {
    const g = p.total_gpus || 0;
    if (g >= 40000) return 'Very High — Massive dedicated fleet';
    if (g >= 15000) return 'High — Large production capacity';
    if (p.layer_type === 'GPU Cloud') return 'High — Elastic cloud scaling';
    if (p.layer_type === 'Edge') return 'Medium-High — Distributed edge';
    return 'Medium — Contact provider for options';
  }

  function deriveReliability(p) {
    const parts = [];
    if (p.sla_uptime_percent) parts.push(`${p.sla_uptime_percent}% SLA`);
    if (p.availability_status) parts.push(p.availability_status);
    return parts.length ? parts.join(' · ') : 'Contact for current SLA';
  }

  function deriveCost(p) {
    if (p.price_per_gpu_hour_usd != null) {
      return `$${p.price_per_gpu_hour_usd.toFixed(2)} / GPU-hr`;
    }
    return 'Quote required (enterprise)';
  }

  function derivePerformance(p) {
    const hwArch = Array.isArray(p.hardware_architectures) ? p.hardware_architectures : (p.hardware_architectures ? [p.hardware_architectures] : []);
    const hw = hwArch.join(', ');
    const ic = p.interconnect ? ` · ${p.interconnect}` : '';
    return hw ? `${hw}${ic}` : 'Not disclosed';
  }

  function deriveEnergy(p) {
    const c = p.cooling_type || 'Not disclosed';
    const note = /liquid|immersion/i.test(c) ? ' (efficient)' : '';
    return `${c}${note}`;
  }

  // ─────────────────────────────────────────────
  // Enterprise Scoring Engine (single source of truth)
  // These MUST be used by both the comparison table (Best In Class highlights)
  // AND the AI prompt builder so that the narrative always matches the UI badges.
  // ─────────────────────────────────────────────

  /**
   * Returns the 5 scoring category definitions with getScore(p) implementations
   * that exactly match the logic in app.js renderComparisonTable.
   * Cost scoring uses the per-use-case costBaselineForQuote for "quote only" providers.
   *
   * ⚠️  IMPORTANT INVARIANT (this has caused the "Compare Providers" tray button to die
   * repeatedly after refactors):
   *   These objects contain ONLY { label, getScore, higherIsBetter }.
   *   They deliberately do NOT have a .get(p) method.
   *
   *   .get(p) is the *display* function (produces human strings like "$1.55 / GPU-hr" or
   *   "99.5% SLA · 2-8 weeks"). It only exists on the local `categories` array defined
   *   inside showComparison() in app.js.
   *
   *   NEVER pass these pure scoring descriptors to code that calls cat.get(p).
   *   The table renderer (renderComparisonTable + updateComparisonHighlights) must
   *   always derive its iteration array from the local `categories` (then only override
   *   getScore for Cost when needed).
   *
   *   The AI prompt builder and numeric "best in class" decisions *are* allowed to use
   *   these (they only need numbers).
   */
  function createScoringCategories(useCaseConfig) {
    const baseline = (useCaseConfig && typeof useCaseConfig.costBaselineForQuote === 'number')
      ? useCaseConfig.costBaselineForQuote
      : 55;

    return [
      {
        label: 'Reliability & Uptime',
        getScore: (p) => p.sla_uptime_percent || 0,
        higherIsBetter: true
      },
      {
        label: 'Cost Efficiency',
        getScore: (p) => {
          if (p.price_per_gpu_hour_usd != null) {
            return 100 - Math.min(p.price_per_gpu_hour_usd, 10) * 8;
          }
          return baseline;
        },
        higherIsBetter: true
      },
      {
        label: 'Scalability',
        getScore: (p) => p.total_gpus || 0,
        higherIsBetter: true
      },
      {
        label: 'High Performance',
        getScore: (p) => {
          const hwArch = Array.isArray(p.hardware_architectures)
            ? p.hardware_architectures
            : (p.hardware_architectures ? [p.hardware_architectures] : []);
          const hw = hwArch.join(' ').toLowerCase();
          if (hw.includes('h200')) return 100;
          if (hw.includes('h100')) return 90;
          if (hw.includes('mi300')) return 80;
          if (hw.includes('a100')) return 70;
          if (hw.includes('l40')) return 60;
          return 30;
        },
        higherIsBetter: true
      },
      {
        label: 'Energy Efficiency',
        getScore: (p) => {
          const c = (p.cooling_type || '').toLowerCase();
          if (c.includes('immersion')) return 100;
          if (c.includes('liquid')) return 80;
          if (c.includes('hybrid')) return 50;
          return 20;
        },
        higherIsBetter: true
      }
    ];
  }

  /**
   * Compute per-provider category scores (clamped 0-100) + overall weighted score.
   * Returns { scored: [{provider, categoryScores: {label: number}, overallScore: number}, ...], scoringCategories, weights }
   * sorted by overallScore desc.
   */
  function computeProviderScores(providers, useCaseConfig) {
    const weights = (useCaseConfig && Array.isArray(useCaseConfig.weights))
      ? useCaseConfig.weights
      : [0.2, 0.2, 0.2, 0.2, 0.2];
    const scoringCategories = createScoringCategories(useCaseConfig);

    const scored = (providers || []).map(provider => {
      let total = 0;
      const categoryScores = {};
      scoringCategories.forEach((cat, i) => {
        const raw = cat.getScore(provider);
        const norm = Math.max(0, Math.min(100, raw || 0));
        categoryScores[cat.label] = norm;
        total += norm * weights[i];
      });
      return { provider, categoryScores, overallScore: total };
    });

    scored.sort((a, b) => b.overallScore - a.overallScore);
    return { scored, scoringCategories, weights };
  }

  /**
   * Determines which providers receive "Best In Class" per category (unique max only)
   * and the overall "highly recommended" via best-count + overall tiebreaker.
   * Returns { bestCounts, categoryWinners, maxBestCount, highlyRecommendedId, highlyRecommendedCount }
   */
  function computeBestInClass(providers, useCaseConfig) {
    const { scored, scoringCategories, weights } = computeProviderScores(providers, useCaseConfig);
    const bestCounts = {};
    (providers || []).forEach(p => { bestCounts[p.id] = 0; });
    const categoryWinners = {}; // label -> providerId or null

    scoringCategories.forEach(cat => {
      const s = (providers || []).map(p => ({ provider: p, score: cat.getScore(p) }));
      const maxScore = s.length ? Math.max(...s.map(x => x.score)) : 0;
      const winners = s.filter(x => x.score === maxScore);
      if (winners.length === 1) {
        const wid = winners[0].provider.id;
        bestCounts[wid] = (bestCounts[wid] || 0) + 1;
        categoryWinners[cat.label] = wid;
      } else {
        categoryWinners[cat.label] = null;
      }
    });

    const maxBestCount = Math.max(0, ...Object.values(bestCounts));
    let topRecommendedIds = Object.entries(bestCounts)
      .filter(([_, count]) => count === maxBestCount && count > 0)
      .map(([id]) => id);

    // Tie-breaker: highest overall score among those with max best-count
    if (topRecommendedIds.length > 1) {
      for (const s of scored) {
        if (topRecommendedIds.includes(s.provider.id)) {
          topRecommendedIds = [s.provider.id];
          break;
        }
      }
    }

    const highlyRecommendedId = topRecommendedIds.length === 1 ? topRecommendedIds[0] : null;
    const highlyRecommendedCount = highlyRecommendedId ? bestCounts[highlyRecommendedId] : 0;

    return {
      bestCounts,
      categoryWinners,
      maxBestCount,
      highlyRecommendedId,
      highlyRecommendedCount,
      scored,
      scoringCategories,
      weights
    };
  }

  // ─────────────────────────────────────────────
  // Use Case definitions + scoring (shared with main page + comparison modal)
  // ─────────────────────────────────────────────

  const USE_CASES = {
    'balanced': {
      name: 'Balanced Enterprise',
      shortName: 'Balanced',
      description: 'General purpose workloads with balanced priorities.',
      weights: [0.28, 0.24, 0.20, 0.16, 0.12], // Reliability, Cost, Scale, Perf, Energy
      costBaselineForQuote: 55
    },
    'training': {
      name: 'Large-Scale Training',
      shortName: 'Training',
      description: 'Long-running, high-throughput training jobs. Scale and raw performance matter most.',
      weights: [0.20, 0.22, 0.28, 0.22, 0.08],
      costBaselineForQuote: 60
    },
    'inference': {
      name: 'Production Inference',
      shortName: 'Inference',
      description: 'Latency-sensitive serving at scale. Price/performance and efficiency are critical.',
      weights: [0.25, 0.30, 0.15, 0.18, 0.12],
      costBaselineForQuote: 50
    },
    'finetuning': {
      name: 'Fine-Tuning & Experimentation',
      shortName: 'Fine-Tuning',
      description: 'Iterative work with mixed job sizes. Flexibility + reasonable cost.',
      weights: [0.22, 0.26, 0.22, 0.18, 0.12],
      costBaselineForQuote: 58
    },
    'research': {
      name: 'Research & Prototyping',
      shortName: 'Research',
      description: 'Exploratory workloads where availability and performance flexibility matter.',
      weights: [0.18, 0.18, 0.26, 0.26, 0.12],
      costBaselineForQuote: 62
    }
  };

  function getUseCases() {
    return USE_CASES;
  }

  /**
   * Computes the overall weighted "Best In Class" score (0-100) for a provider
   * under a specific Use Case. Reuses the existing scoring engine.
   */
  function computeProviderUseCaseScore(provider, useCaseKey) {
    const uc = USE_CASES[useCaseKey];
    if (!uc) return 0;

    const { scored } = computeProviderScores([provider], uc);
    if (scored.length === 0) return 0;
    return scored[0].overallScore;
  }

  // Expose new functions
  Object.assign(window.FlopSourceUtils, {
    getUseCases,
    computeProviderUseCaseScore,
  });

  window.getUseCases = getUseCases;
  window.computeProviderUseCaseScore = computeProviderUseCaseScore;

  // Expose
  Object.assign(window.FlopSourceUtils, {
    debounce,
    safeValue,
    escapeHTML,
    deriveScalability,
    deriveReliability,
    deriveCost,
    derivePerformance,
    deriveEnergy,
    createScoringCategories,
    computeProviderScores,
    computeBestInClass,
  });

  // Also attach to global for easy access during transition
  window.debounce = debounce;
  window.escapeHTML = escapeHTML;
  window.safeValue = safeValue;
  window.deriveScalability = deriveScalability;
  window.deriveReliability = deriveReliability;
  window.deriveCost = deriveCost;
  window.derivePerformance = derivePerformance;
  window.deriveEnergy = deriveEnergy;
  window.createScoringCategories = createScoringCategories;
  window.computeProviderScores = computeProviderScores;
  window.computeBestInClass = computeBestInClass;

  // ─────────────────────────────────────────────
  // Theme-aware palette functions (used by comparison UI)
  // These have light coupling to document but are useful to centralize.
  // ─────────────────────────────────────────────
  function getCurrentTheme() {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }

  function getComparisonPalette() {
    const dark = getCurrentTheme() === 'dark';
    if (dark) {
      return {
        trayBg: '#1e293b',
        trayBorder: '#38bdf8',
        headerBg: '#0b1120',
        headerBorder: '#334155',
        headerText: '#38bdf8',
        listBg: '#1e293b',
        itemText: '#f8fafc',
        itemSub: '#94a3b8',
        removeBg: 'rgba(248,113,113,0.15)',
        removeColor: '#f87171',
        footerBg: '#0f172a',
        footerBorder: '#334155',
        compareBtnBg: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
        compareBtnColor: '#0f172a',
        countBg: '#38bdf8',
        countColor: '#0f172a',
        dragHint: 'rgba(56,189,248,0.6)'
      };
    }
    return {
      trayBg: '#ffffff',
      trayBorder: '#1e40af',
      headerBg: '#eff6ff',
      headerBorder: '#93c5fd',
      headerText: '#1e40af',
      listBg: '#ffffff',
      itemText: '#0f172a',
      itemSub: '#64748b',
      removeBg: '#fee2e2',
      removeColor: '#b91c1c',
      footerBg: '#fafafa',
      footerBorder: '#e5e7eb',
      compareBtnBg: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
      compareBtnColor: '#ffffff',
      countBg: '#1e40af',
      countColor: '#ffffff',
      dragHint: '#1e40af'
    };
  }

  function getBestHighlightStyle() {
    const dark = getCurrentTheme() === 'dark';
    if (dark) {
      return {
        cell: 'background:rgba(56,189,248,0.12);border:2px solid #38bdf8;font-weight:500;',
        badge: ' <span style="font-size:0.7rem;color:#bae6fd;font-weight:700;background:rgba(56,189,248,0.2);padding:1px 5px;border-radius:3px;">★ BEST IN CLASS</span>',
        badgeText: '#bae6fd'
      };
    }
    return {
      cell: 'background:#dbeafe;border:2px solid #2563eb;font-weight:500;',
      badge: ' <span style="font-size:0.7rem;color:#1e40af;font-weight:700;background:#bfdbfe;padding:1px 5px;border-radius:3px;">★ BEST IN CLASS</span>',
      badgeText: '#1e40af'
    };
  }

  /**
   * Parser for the AI RANKING line the model is now instructed to emit first.
   * Returns { primaryId, secondId, thirdId, primaryName, ... } or null.
   * Robust name matching against the currently selected providers.
   */
  function parseAiRanking(analysisText, selectedProviders) {
    if (!analysisText || !Array.isArray(selectedProviders) || selectedProviders.length === 0) return null;

    // Primary pattern: the exact format we request in the prompt
    let match = analysisText.match(/AI\s*RANKING\s*:\s*1\.\s*([^|]+?)\s*\|\s*2\.\s*([^|]+?)\s*\|\s*3\.\s*([^|\n\r]+)/i);

    if (!match) {
      // Fallbacks for slight model variation
      match = analysisText.match(/RANKING\s*:\s*1\.\s*([^|]+?)\s*\|\s*2\.\s*([^|]+?)\s*\|\s*3\.\s*([^|\n\r]+)/i);
    }
    if (!match) {
      // Last resort: look for "Primary recommendation: Name" style phrases
      const primaryMatch = analysisText.match(/(?:primary|strongest|top|best)\s*(?:recommendation|overall|pick|choice)?\s*[:\-]?\s*([A-Za-z0-9\-\s]+?)(?:\.|,|is|for)/i);
      if (primaryMatch) {
        const nameGuess = primaryMatch[1].trim();
        const found = selectedProviders.find(p => p.provider_name.toLowerCase().includes(nameGuess.toLowerCase()) || nameGuess.toLowerCase().includes(p.provider_name.toLowerCase()));
        if (found) return { primaryId: found.id, primaryName: found.provider_name, secondId: null, thirdId: null };
      }
      return null;
    }

    const raw = [match[1], match[2], match[3]].map(s => s.trim());

    const findProvider = (rawName) => {
      if (!rawName) return null;
      const n = rawName.toLowerCase();
      return selectedProviders.find(p => {
        const pn = p.provider_name.toLowerCase();
        return pn === n || pn.includes(n) || n.includes(pn);
      });
    };

    const p1 = findProvider(raw[0]);
    const p2 = findProvider(raw[1]);
    const p3 = findProvider(raw[2]);

    if (!p1) return null;

    return {
      primaryId: p1.id,
      primaryName: p1.provider_name,
      secondId: p2 ? p2.id : null,
      secondName: p2 ? p2.provider_name : null,
      thirdId: p3 ? p3.id : null,
      thirdName: p3 ? p3.provider_name : null
    };
  }

  /**
   * Theme-aware highlight styles for AI-driven ranking (after use case selection).
   * Rank 1 = strong "Best In Class" (cyan/green).
   * Rank 2 = amber/gold runner-up.
   * Rank 3 = purple/violet runner-up.
   */
  function getAiRankHighlightStyle(rank) {
    const dark = getCurrentTheme() === 'dark';
    const r = Number(rank) || 1;

    if (r === 1) {
      if (dark) {
        return {
          cell: 'background:rgba(56,189,248,0.12);border:2px solid #38bdf8;font-weight:500;',
          badge: ' <span style="font-size:0.7rem;color:#bae6fd;font-weight:700;background:rgba(56,189,248,0.2);padding:1px 5px;border-radius:3px;">★ AI BEST IN CLASS</span>',
          badgeText: '#bae6fd',
          label: 'AI #1'
        };
      }
      return {
        cell: 'background:#dbeafe;border:2px solid #2563eb;font-weight:500;',
        badge: ' <span style="font-size:0.7rem;color:#1e40af;font-weight:700;background:#bfdbfe;padding:1px 5px;border-radius:3px;">★ AI BEST IN CLASS</span>',
        badgeText: '#1e40af',
        label: 'AI #1'
      };
    }

    if (r === 2) {
      if (dark) {
        return {
          cell: 'background:rgba(251,191,36,0.10);border:2px solid #f59e0b;font-weight:500;',
          badge: ' <span style="font-size:0.7rem;color:#fcd34d;font-weight:700;background:rgba(251,191,36,0.18);padding:1px 5px;border-radius:3px;">2ND (AI)</span>',
          badgeText: '#fcd34d',
          label: 'AI 2nd'
        };
      }
      return {
        cell: 'background:#fef3c7;border:2px solid #d97706;font-weight:500;',
        badge: ' <span style="font-size:0.7rem;color:#92400e;font-weight:700;background:#fde68a;padding:1px 5px;border-radius:3px;">2ND (AI)</span>',
        badgeText: '#92400e',
        label: 'AI 2nd'
      };
    }

    // rank 3
    if (dark) {
      return {
        cell: 'background:rgba(167,139,250,0.10);border:2px solid #8b5cf6;font-weight:500;',
        badge: ' <span style="font-size:0.7rem;color:#c4b5fd;font-weight:700;background:rgba(167,139,250,0.18);padding:1px 5px;border-radius:3px;">3RD (AI)</span>',
        badgeText: '#c4b5fd',
        label: 'AI 3rd'
      };
    }
    return {
      cell: 'background:#ede9fe;border:2px solid #7c3aed;font-weight:500;',
      badge: ' <span style="font-size:0.7rem;color:#5b21b6;font-weight:700;background:#ddd6fe;padding:1px 5px;border-radius:3px;">3RD (AI)</span>',
      badgeText: '#5b21b6',
      label: 'AI 3rd'
    };
  }

  /**
   * New shading/mask system for consistent column hierarchy in AI mode.
   * Best In Class (rank 1) = clear / primary highlight (strong but clean).
   * 2nd = 33% opacity mask.
   * 3rd = 66% opacity mask.
   * Everything else = 85% opacity blurred mask (heavily de-emphasized).
   *
   * These are designed to be applied as background on the entire column.
   */
  function getAiColumnMaskStyle(rankOrType) {
    const dark = getCurrentTheme() === 'dark';
    const type = (typeof rankOrType === 'number') ? rankOrType : (rankOrType || 'other');

    if (type === 1 || type === 'primary' || type === 'best') {
      // Best In Class — clear, strong primary highlight (no heavy mask)
      if (dark) {
        return {
          background: 'rgba(56, 189, 248, 0.18)',
          borderLeft: '3px solid #38bdf8',
          filter: 'none',
          opacity: '1'
        };
      }
      return {
        background: 'rgba(37, 99, 235, 0.12)',
        borderLeft: '3px solid #2563eb',
        filter: 'none',
        opacity: '1'
      };
    }

    if (type === 2 || type === 'secondary') {
      // Second best — 33% opacity mask
      if (dark) {
        return {
          background: 'rgba(15, 23, 42, 0.33)',
          borderLeft: '2px solid #64748b',
          filter: 'none',
          opacity: '0.67'
        };
      }
      return {
        background: 'rgba(191, 219, 254, 0.40)',
        borderLeft: '2px solid #3b82f6',
        filter: 'none',
        opacity: '0.60'
      };
    }

    if (type === 3 || type === 'tertiary') {
      // Third best — 66% opacity mask
      if (dark) {
        return {
          background: 'rgba(15, 23, 42, 0.66)',
          borderLeft: '1px solid #475569',
          filter: 'none',
          opacity: '0.34'
        };
      }
      return {
        background: 'rgba(191, 219, 254, 0.65)',
        borderLeft: '1px solid #3b82f6',
        filter: 'none',
        opacity: '0.35'
      };
    }

    // Everything else — 85% opacity blurred mask (heavily de-emphasized)
    if (dark) {
      return {
        background: 'rgba(15, 23, 42, 0.85)',
        borderLeft: '1px solid #334155',
        filter: 'blur(0.5px) grayscale(0.3)',
        opacity: '0.15'
      };
    }
    return {
      background: 'rgba(191, 219, 254, 0.75)',
      borderLeft: '1px solid #93c5fd',
      filter: 'blur(0.5px) grayscale(0.3)',
      opacity: '0.25'
    };
  }

  Object.assign(window.FlopSourceUtils, {
    getCurrentTheme,
    getComparisonPalette,
    getBestHighlightStyle,
    parseAiRanking,
    getAiRankHighlightStyle,
    getAiColumnMaskStyle,
  });

  window.getCurrentTheme = getCurrentTheme;
  window.getComparisonPalette = getComparisonPalette;
  window.getBestHighlightStyle = getBestHighlightStyle;
  window.parseAiRanking = parseAiRanking;
  window.getAiRankHighlightStyle = getAiRankHighlightStyle;
  window.getAiColumnMaskStyle = getAiColumnMaskStyle;
})();