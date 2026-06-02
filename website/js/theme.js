/**
 * theme.js
 * FlopSource — Theme management (light corporate / dark bento)
 * Extracted for modularity.
 */

(() => {
  'use strict';

  function getCurrentTheme() {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }

  function setTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    try { localStorage.setItem('flopsource-theme', isDark ? 'dark' : 'light'); } catch (e) {}

    updateThemeTag();

    // If the floating comparison tray is currently visible, rebuild it with correct palette
    const tray = document.getElementById('comparison-tray');
    if (tray && tray.style.display !== 'none' && (window.state?.comparisonSelection?.size >= 2 || (window.FlopSource && window.FlopSource.state?.comparisonSelection?.size >= 2))) {
      setTimeout(() => {
        try { 
          if (typeof updateFloatingComparisonPanel === 'function') updateFloatingComparisonPanel(); 
        } catch (_) {}
      }, 30);
    }
  }

  function updateThemeTag() {
    const tag = document.getElementById('theme-tag');
    if (!tag) return;
    const isDark = document.documentElement.classList.contains('dark');
    tag.textContent = isDark ? 'DARK' : 'LIGHT';
  }

  function toggleTheme() {
    const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }

  // Apply saved theme on load (in addition to the early inline script in index.html)
  function applySavedTheme() {
    try {
      const saved = localStorage.getItem('flopsource-theme');
      if (saved === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (saved === 'light') {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
    updateThemeTag();
  }

  // Auto-apply on script load
  applySavedTheme();

  // Set initial tag state
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateThemeTag);
  } else {
    updateThemeTag();
  }

  // Auto-wire the logo toggle button (defensive)
  function wireThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleTheme();

        // Keep FlopSource brand logo in sync (re-bake SVG fills for new theme)
        // The brand bakes accent/bg colors at render time, so we must re-render after flip.
        try {
          const brand = window.FlopSourceBrand;
          if (brand && typeof brand.setTheme === 'function' && typeof brand.renderLogo === 'function') {
            const isDark = document.documentElement.classList.contains('dark');
            brand.setTheme(isDark ? 'dark' : 'light');
            // Re-render the header logo (it was mounted with showTagline:false)
            const nav = document.getElementById('nav-logo');
            if (nav) brand.renderLogo(nav, { size: 'sm', showTagline: false });
          }
        } catch (_) {}
      });
    }
  }

  // Wire after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireThemeToggle);
  } else {
    wireThemeToggle();
  }

  // Expose
  window.FlopSourceTheme = {
    getCurrentTheme,
    setTheme,
    toggleTheme,
    applySavedTheme
  };

  // Globals for transition
  window.getCurrentTheme = getCurrentTheme;
  window.setTheme = setTheme;
  window.toggleTheme = toggleTheme;
})();