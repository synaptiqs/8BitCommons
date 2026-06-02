/**
 * FlopSource Brand — Core Matrix Logo System
 * Handles: theme management, logo rendering, favicon injection, PNG export
 *
 * Usage (ESM):
 *   import FlopSource from './flopsource-brand.js';
 *   FlopSource.init({ theme: 'auto', favicon: true });
 *   FlopSource.renderLogo('#nav-logo', { size: 'md' });
 *
 * Usage (inline script):
 *   <script src="flopsource-brand.js"></script>
 *   <script>FlopSource.init();</script>
 */

const FlopSource = (() => {

  /* ─── Design Tokens ─────────────────────────────────────────────────── */
  const TOKENS = {
    dark: {
      accent:  '#38bdf8',
      markBg:  '#0c1a2e',
      text:    '#f1f5f9',
      tagline: '#475569',
    },
    light: {
      accent:  '#2563eb',
      markBg:  '#eff6ff',
      text:    '#0f172a',
      tagline: '#94a3b8',
    },
  };

  /* ─── Size Scale ────────────────────────────────────────────────────── */
  const SIZES = {
    xs: { mark: 24, name: 13,  tag: 6,    gap: 8  },
    sm: { mark: 28, name: 15,  tag: 6.5,  gap: 10 },
    md: { mark: 36, name: 18,  tag: 7.5,  gap: 12 },
    lg: { mark: 48, name: 24,  tag: 9,    gap: 14 },
    xl: { mark: 64, name: 32,  tag: 11,   gap: 18 },
  };

  /* ─── 6-dot F pattern positions (normalized 0–1 grid) ─────────────── */
  // Each entry is [col, row] in a 3×3 grid, active cells only.
  const DOT_GRID = [
    [0, 0], [1, 0], [2, 0],  // row 0 — top bar   (● ● ●)
    [0, 1], [1, 1],           // row 1 — mid bar   (● ●  )
    [0, 2],                   // row 2 — stem      (●    )
  ];

  /* ─── State ─────────────────────────────────────────────────────────── */
  let _theme = 'auto';

  /* ─── Internal helpers ──────────────────────────────────────────────── */
  function _resolvedTheme() {
    if (_theme !== 'auto') return _theme;
    // Prefer explicit saved choice (set by legacy theme.js) over pure media query
    try {
      const saved = localStorage.getItem('flopsource-theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (_) {}
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function _tokens() {
    return TOKENS[_resolvedTheme()];
  }

  /** Removed the background from the Logo Square 053126
   * Build the 6-dot SVG mark as a string.
   * @param {number} size     - Canvas size in px (square)
   * @param {string} mode     - 'dark' | 'light' | 'auto'
   * @param {boolean} withBg  - Include rounded-rect background container
   */
  function _buildMarkSVG(size, mode, withBg = false) {
    const t = TOKENS[mode === 'auto' ? _resolvedTheme() : mode];

    // Robust grid layout: always keep the 6-dot F pattern fully inside the bg square.
    // Virtual 3x3 cells guarantee the logo (dots) never exceeds the square "shadow" container.
    const margin = Math.max(3, Math.round(size * 0.135));
    const cells = 3;
    const cell = (size - margin * 2) / cells;
    const dotSize = Math.max(2, Math.floor(cell * 0.70)); // 70% fill leaves visual breathing room
    const rx = Math.max(1, Math.round(dotSize * 0.22));

    const dots = DOT_GRID.map(([col, row]) => {
      // center each dot inside its cell so the whole mark is balanced and inset
      const cx = margin + col * cell + (cell - dotSize) / 2;
      const cy = margin + row * cell + (cell - dotSize) / 2;
      const x = cx.toFixed(1);
      const y = cy.toFixed(1);
      return `<rect class="fs-mark-dot" x="${x}" y="${y}" width="${dotSize}" height="${dotSize}" rx="${rx}" fill="${t.accent}"/>`;
    }).join('\n  ');

    const bg = withBg
      ? `<rect class="fs-mark-bg" width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="${t.markBg}"/>\n  `
      : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="FlopSource mark">
  ${bg}${dots}
</svg>`;
  }

  /**
   * Build the full logo lockup (mark + wordmark) as an SVG string.
   * @param {object} opts
   *   size        {string}  'xs'|'sm'|'md'|'lg'|'xl'
   *   mode        {string}  'dark'|'light'|'auto'
   *   showTagline {boolean} include 'AI COMPUTE DIRECTORY' tagline
   *   withBg      {boolean} include mark background
   */
  function _buildLockupSVG(opts = {}) {
    const {
      size        = 'md',
      mode        = 'auto',
      showTagline = true,
      withBg      = true,
    } = opts;

    const s = SIZES[size] || SIZES.md;
    const t = TOKENS[mode === 'auto' ? _resolvedTheme() : mode];

    // Build mark inner content (no outer <svg> wrapper)
    const markSVG = _buildMarkSVG(s.mark, mode, withBg);
    const markInner = markSVG.replace(/<svg[^>]*>\n?/, '').replace(/<\/svg>/, '').trim();

    // Text positions
    const textX   = s.mark + s.gap;
    const nameY   = (s.mark / 2 + s.name * 0.38).toFixed(1);
    const tagY    = (s.mark / 2 + s.name * 0.38 + s.name * 0.85).toFixed(1);

    // Estimate total width (generous)
    const estNameW = s.name * 6.2;          // "FlopSource" ~10 chars × ~0.62em
    const estTagW  = showTagline
      ? (s.tag * 1.45 * 20)                 // "AI COMPUTE DIRECTORY" ~20 chars
      : 0;
    const totalW   = Math.ceil(textX + Math.max(estNameW, estTagW) + 4);

    const tagLine = showTagline
      ? `\n  <text x="${textX}" y="${tagY}"
      font-family="Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
      font-size="${s.tag}" font-weight="400" fill="${t.tagline}" letter-spacing="2.3">AI COMPUTE DIRECTORY</text>`
      : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${s.mark}" viewBox="0 0 ${totalW} ${s.mark}" role="img" aria-label="FlopSource">
  ${markInner}
  <text x="${textX}" y="${nameY}"
      font-family="Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
      font-size="${s.name}" font-weight="700" fill="${t.text}" letter-spacing="-0.5">FlopSource</text>${tagLine}
</svg>`;
  }

  /* ─── Public API ────────────────────────────────────────────────────── */

  /**
   * Render a logo lockup into a DOM element.
   * The element gets a CSS class `fs-logo` and size modifier automatically.
   *
   * @param {string|Element} target  - CSS selector or DOM element
   * @param {object} opts            - same as _buildLockupSVG options
   */
  function renderLogo(target, opts = {}) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return console.warn('[FlopSource] renderLogo: target not found', target);

    const { size = 'md' } = opts;
    const svg = _buildLockupSVG({ ...opts, mode: opts.mode || _theme });

    el.innerHTML = svg;
    el.classList.add('fs-logo', `fs-logo--${size}`);
  }

  /**
   * Render just the mark (icon) into a DOM element.
   */
  function renderMark(target, sizeInPx = 36, opts = {}) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    el.innerHTML = _buildMarkSVG(sizeInPx, opts.mode || _theme, opts.withBg !== false);
  }

  /**
   * Inject adaptive SVG favicon + PNG canvas fallback.
   * Removes any pre-existing favicon <link> tags first.
   */
  function injectFavicon() {
    // Remove stale favicons
    document.querySelectorAll('link[rel*="icon"]').forEach(n => n.remove());

    // ── SVG favicon (modern browsers, auto dark/light via CSS) ──────────
    const faviconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <style>
    .bg  { fill: #0c1a2e; }
    .dot { fill: #38bdf8; }
    @media (prefers-color-scheme: light) {
      .bg  { fill: #eff6ff; }
      .dot { fill: #2563eb; }
    }
  </style>
  <rect class="bg" width="32" height="32" rx="7"/>
  <rect class="dot" x="4"  y="4"  width="7" height="7" rx="1.5"/>
  <rect class="dot" x="13" y="4"  width="7" height="7" rx="1.5"/>
  <rect class="dot" x="22" y="4"  width="7" height="7" rx="1.5"/>
  <rect class="dot" x="4"  y="13" width="7" height="7" rx="1.5"/>
  <rect class="dot" x="13" y="13" width="7" height="7" rx="1.5"/>
  <rect class="dot" x="4"  y="22" width="7" height="7" rx="1.5"/>
</svg>`;

    const svgHref = `data:image/svg+xml,${encodeURIComponent(faviconSVG)}`;

    const svgLink      = document.createElement('link');
    svgLink.rel        = 'icon';
    svgLink.type       = 'image/svg+xml';
    svgLink.href       = svgHref;
    document.head.appendChild(svgLink);

    // Apple touch icon (180×180, always use resolved theme)
    _generatePNGFavicon(180, true).then(href => {
      const apple      = document.createElement('link');
      apple.rel        = 'apple-touch-icon';
      apple.sizes      = '180x180';
      apple.href       = href;
      document.head.appendChild(apple);
    });

    // PNG fallback (32×32, for legacy browsers / tab bar)
    _generatePNGFavicon(32, true).then(href => {
      const png        = document.createElement('link');
      png.rel          = 'alternate icon';
      png.type         = 'image/png';
      png.sizes        = '32x32';
      png.href         = href;
      document.head.appendChild(png);
    });
  }

  /**
   * Rasterize the mark to a PNG data-URL via canvas.
   * Returns a Promise<string>.
   * @param {number}  size    - pixel size (square)
   * @param {boolean} withBg  - include background
   */
  function _generatePNGFavicon(size = 32, withBg = true) {
    return new Promise(resolve => {
      const mode   = _resolvedTheme();
      const svg    = _buildMarkSVG(size * 2, mode, withBg); // 2× for retina
      const blob   = new Blob([svg], { type: 'image/svg+xml' });
      const url    = URL.createObjectURL(blob);
      const img    = new Image();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;

      img.onload = () => {
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
      img.src = url;
    });
  }

  /**
   * Export mark as a PNG Blob at given size.
   * Useful for og:image generation or download buttons.
   * Returns a Promise<Blob>.
   */
  function exportPNG(sizeInPx = 512, withBg = true) {
    return _generatePNGFavicon(sizeInPx, withBg).then(dataUrl => {
      const [, base64] = dataUrl.split(',');
      const bytes      = atob(base64);
      const buf        = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
      return new Blob([buf], { type: 'image/png' });
    });
  }

  /**
   * Set the active theme. Writes `data-theme` onto <html>.
   * @param {'dark'|'light'|'auto'} theme
   */
  function setTheme(theme) {
    _theme = theme;
    const resolved = _resolvedTheme();
    document.documentElement.setAttribute('data-theme', resolved);
    document.dispatchEvent(new CustomEvent('flopSourceThemeChange', {
      detail: { theme, resolved },
    }));
  }

  function getTheme()         { return _theme; }
  function getResolvedTheme() { return _resolvedTheme(); }

  /**
   * Retrieve the SVG string for the mark or full lockup.
   * Useful for injecting into <img src="...">, server-side rendering, emails.
   */
  function getSVG(type = 'lockup', opts = {}) {
    if (type === 'mark') return _buildMarkSVG(opts.size || 48, opts.mode || _theme, opts.withBg !== false);
    return _buildLockupSVG(opts);
  }

  /**
   * Bootstrap everything.
   * @param {object} opts
   *   theme   {'dark'|'light'|'auto'}  default: 'auto'
   *   favicon {boolean}                inject favicon, default: true
   *   logos   {string[]}               CSS selectors of elements to auto-render logos into
   *   size    {string}                 default size for auto-rendered logos, default: 'md'
   */
  function init(opts = {}) {
    const {
      theme   = 'auto',
      favicon = true,
      logos   = [],
      size    = 'md',
    } = opts;

    setTheme(theme);

    const boot = () => {
      if (favicon) injectFavicon();
      logos.forEach(selector => renderLogo(selector, { size }));
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }

    // Re-inject favicon when OS theme flips (only in auto mode)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (_theme === 'auto') {
        setTheme('auto');
        if (favicon) injectFavicon();
        logos.forEach(selector => renderLogo(selector, { size }));
      }
    });
  }

  /* ─── Public surface ────────────────────────────────────────────────── */
  return {
    init,
    setTheme,
    getTheme,
    getResolvedTheme,
    renderLogo,
    renderMark,
    injectFavicon,
    exportPNG,
    getSVG,
    TOKENS,
    SIZES,
  };

})();

export default FlopSource;

// CommonJS compat
if (typeof module !== 'undefined') module.exports = FlopSource;
