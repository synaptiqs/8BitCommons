/**
 * components.js
 * FlopSource — Redesigned UI Components
 * Pure rendering functions. No side effects. All data is passed in.
 */

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const Components = (() => {

  // Layer type → CSS class mappings
  const LAYER_CLASS = {
    'GPU Cloud':  { card: 'card-cloud', badge: 'badge-cloud' },
    'Bare-Metal': { card: 'card-bare',  badge: 'badge-bare'  },
    'Edge':       { card: 'card-edge',  badge: 'badge-edge'  }
  };

  function getLayerClass(layerType) {
    return LAYER_CLASS[layerType] || { card: 'card-cloud', badge: 'badge-cloud' };
  }

  function availPillHTML(status) {
    if (!status) return `<span class="avail-pill avail-wait">Unknown</span>`;
    const isNow = status.toLowerCase().includes('immediate');
    const icon = isNow
      ? `<i class="fa-solid fa-circle" style="font-size:0.42rem;"></i>`
      : `<i class="fa-regular fa-clock" style="font-size:0.58rem;"></i>`;
    return `<span class="avail-pill ${isNow ? 'avail-now' : 'avail-wait'}">${icon}${status}</span>`;
  }

  function qualityHTML(quality) {
    const dotClass = { high: 'q-high', medium: 'q-medium', low: 'q-low' }[quality] || 'q-low';
    const label = quality ? quality.charAt(0).toUpperCase() + quality.slice(1) : 'Unknown';
    return `<span class="qdot ${dotClass}"></span><span style="font-size:0.68rem; color:var(--text-secondary);">${label}</span>`;
  }

  function freshnessTag(quality, lastVerified) {
    if (quality === 'high') {
      return `<span class="freshness-live" title="Price scraped live from provider source this run"><span class="live-dot"></span>Live</span>`;
    }
    let dateStr = 'Unknown';
    if (lastVerified) {
      const d = new Date(lastVerified + 'T00:00:00');
      dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return `<span class="freshness-dated" title="Fallback data — provider verified active but price is from research"><i class="fa-regular fa-clock" style="font-size:0.55rem; opacity:0.55;"></i>${escapeHTML(dateStr)}</span>`;
  }

  // ─────────────────────────────────────────────────
  // PROVIDER CARD
  // ─────────────────────────────────────────────────
  function createProviderCard(provider, useCaseContext = null) {
    const card = document.createElement('div');
    const lc = getLayerClass(provider.layer_type);
    card.className = `provider-card ${lc.card}`;
    card.dataset.providerId = provider.id;
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `View details for ${provider.provider_name}`);

    const hwArray = Array.isArray(provider.hardware_architectures) 
      ? provider.hardware_architectures 
      : (provider.hardware_architectures ? [provider.hardware_architectures] : []);
    const hwChips = hwArray
      .slice(0, 3)
      .map(h => `<span class="hw-chip">${escapeHTML(h)}</span>`)
      .join('');

    const gpus = provider.total_gpus
      ? provider.total_gpus.toLocaleString()
      : '—';

    const bw = provider.network_bandwidth_gbps
      ? `${(provider.network_bandwidth_gbps / 1000).toFixed(1)}<span style="font-size:0.58rem; font-weight:400; margin-left:1px;">Tbps</span>`
      : '—';

    const uptime = provider.sla_uptime_percent
      ? `${provider.sla_uptime_percent}<span style="font-size:0.58rem; font-weight:400;">%</span>`
      : '—';

    const price = provider.price_per_gpu_hour_usd
      ? `$${provider.price_per_gpu_hour_usd.toFixed(2)}<span style="font-size:0.6rem; color:var(--text-secondary); font-weight:400;">/GPU-hr</span>`
      : `<span style="color:var(--text-secondary); font-size:0.72rem; font-weight:400;">Quote only</span>`;

    const hasWebsite = !!provider.website;

    card.innerHTML = `
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:3px;">
        <div class="card-name" style="display:flex; align-items:center; gap:6px;">
          ${escapeHTML(provider.provider_name)}
          ${hasWebsite ? `
            <a href="${provider.website}" target="_blank" rel="noopener" 
               class="visit-link" title="Visit official site"
               style="color:var(--text-secondary); font-size:0.65rem; opacity:0.6; transition:opacity .15s;"
               onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">
              <i class="fa-solid fa-external-link-alt"></i>
            </a>
          ` : ''}
        </div>
        ${availPillHTML(provider.availability_status)}
      </div>

      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:12px;">
        <div class="card-location">
          <i class="fa-solid fa-location-dot" style="font-size:0.58rem; margin-right:3px; opacity:0.45;"></i>${escapeHTML(provider.primary_location || 'Location undisclosed')}
        </div>
        <span class="layer-badge ${lc.badge}">${escapeHTML(provider.layer_type)}</span>
      </div>

      ${useCaseContext ? `
        <div style="margin-bottom:10px; display:flex; align-items:center; gap:6px;">
          <span style="font-size:0.62rem; background:linear-gradient(90deg, #1e40af, #3b82f6); color:white; padding:2px 8px; border-radius:999px; font-weight:700; white-space:nowrap;">
            ★ ${useCaseContext.score} — Best for ${escapeHTML(useCaseContext.name)}
          </span>
        </div>
      ` : ''}

      <div style="margin-bottom:12px;">
        <div style="font-size:0.56rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-secondary); margin-bottom:5px; font-weight:600;">Hardware</div>
        <div style="display:flex; flex-wrap:wrap; gap:4px;">
          ${hwChips || '<span style="font-size:0.68rem; color:var(--text-secondary);">Not disclosed</span>'}
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-bottom:12px;">
        <div style="background:var(--bg-inner); border:1px solid var(--border); border-radius:8px; padding:7px 6px; text-align:center;">
          <div class="card-metric-val">${gpus}</div>
          <div class="card-metric-lbl">GPUs</div>
        </div>
        <div style="background:var(--bg-inner); border:1px solid var(--border); border-radius:8px; padding:7px 6px; text-align:center;">
          <div class="card-metric-val">${bw}</div>
          <div class="card-metric-lbl">Network</div>
        </div>
        <div style="background:var(--bg-inner); border:1px solid var(--border); border-radius:8px; padding:7px 6px; text-align:center;">
          <div class="card-metric-val">${uptime}</div>
          <div class="card-metric-lbl">Uptime</div>
        </div>
      </div>

      <div style="display:flex; align-items:center; justify-content:space-between; padding-top:10px; border-top:1px solid var(--border);">
        <div style="font-size:0.8rem; font-weight:600; color:var(--text-primary); font-variant-numeric:tabular-nums;">${price}</div>
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="display:flex; align-items:center; gap:4px;">${freshnessTag(provider.data_quality, provider.last_verified)}</div>

          <!-- Compare toggle -->
          <button class="compare-btn" data-id="${provider.id}" 
                  style="font-size:0.68rem; padding:3px 10px; border:1px solid #1e40af; background:#eff6ff; border-radius:6px; cursor:pointer; color:#1e40af; font-weight:600; transition:all .1s; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;"
                  title="Add to comparison (max 10)">
            <i class="fa-solid fa-columns" style="font-size:0.7rem;"></i>
            <span>Compare</span>
          </button>

          <div class="card-arrow" style="color:var(--text-secondary); font-size:0.68rem; display:flex; align-items:center; gap:3px; font-weight:500; transition:color 0.15s;">
            View <i class="fa-solid fa-arrow-right" style="font-size:0.58rem;"></i>
          </div>
        </div>
      </div>
    `;

    card.addEventListener('mouseenter', () => {
      const a = card.querySelector('.card-arrow');
      if (a) a.style.color = 'var(--accent)';
    });
    card.addEventListener('mouseleave', () => {
      const a = card.querySelector('.card-arrow');
      if (a) a.style.color = 'var(--text-secondary)';
    });

    // Prevent card click from opening the detail modal when interacting with action controls
    const visitLink = card.querySelector('.visit-link');
    if (visitLink) {
      visitLink.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
      });
    }

    return card;
  }

  // ─────────────────────────────────────────────────
  // FILTER SECTION — pill toggle buttons
  // ─────────────────────────────────────────────────
  function createFilterSection(title, options, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'flex flex-wrap gap-1.5';

    options.forEach(opt => {
      const pill = document.createElement('button');
      pill.className = 'f-pill';
      pill.type = 'button';
      pill.dataset.value = opt.value;
      pill.innerHTML = opt.label + (opt.count ? ` <span class="pcount">·${opt.count}</span>` : '');

      pill.addEventListener('click', () => {
        const isSelected = pill.classList.toggle('selected');
        onChange(opt.value, isSelected);
      });

      wrap.appendChild(pill);
    });

    return wrap;
  }

  // ─────────────────────────────────────────────────
  // MODAL BODY CONTENT
  // ─────────────────────────────────────────────────
  function renderModalContent(provider) {
    const lc = getLayerClass(provider.layer_type);

    const gpus   = provider.total_gpus?.toLocaleString() || '—';
    const bw     = provider.network_bandwidth_gbps ? `${(provider.network_bandwidth_gbps / 1000).toFixed(1)} Tbps` : '—';
    const uptime = provider.sla_uptime_percent ? `${provider.sla_uptime_percent}%` : '—';
    const priceVal   = provider.price_per_gpu_hour_usd ? `$${provider.price_per_gpu_hour_usd.toFixed(2)}` : '—';
    const priceLabel = provider.price_per_gpu_hour_usd ? 'per GPU-hr' : 'Quote only';

    const hwArray = Array.isArray(provider.hardware_architectures) 
      ? provider.hardware_architectures 
      : (provider.hardware_architectures ? [provider.hardware_architectures] : []);
    const hw = hwArray
      .map(h => `<span class="hw-chip" style="font-size:0.72rem; padding:4px 10px;">${escapeHTML(h)}</span>`)
      .join('');

    const certs = (provider.certifications || []).length > 0
      ? provider.certifications.map(c => `<span class="cert-badge">${escapeHTML(c)}</span>`).join('')
      : `<span style="font-size:0.78rem; color:var(--text-secondary);">None listed</span>`;

    const quality = provider.data_quality || 'medium';

    let verifiedText = 'Unknown';
    if (provider.last_verified) {
      verifiedText = new Date(provider.last_verified)
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    const sourcesHTML = (provider.source_urls || []).length > 0
      ? provider.source_urls.map(url => {
          try {
            return `<a href="${url}" target="_blank" rel="noopener" style="color:var(--accent); text-decoration:none; font-size:0.72rem;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${new URL(url).hostname}</a>`;
          } catch { return ''; }
        }).filter(Boolean).join('<span style="color:var(--text-muted); margin:0 5px;">·</span>')
      : '<span style="color:var(--text-secondary); font-size:0.72rem;">No sources listed</span>';

    return `
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
        <span class="layer-badge ${lc.badge}" style="font-size:0.7rem; padding:4px 12px;">${escapeHTML(provider.layer_type)}</span>
        ${availPillHTML(provider.availability_status)}
      </div>

      ${provider.website ? `
        <div style="margin-bottom:12px;">
          <a href="${provider.website}" target="_blank" rel="noopener" 
             style="color:var(--accent); text-decoration:none; font-weight:600; font-size:0.95rem;">
            ${escapeHTML(provider.provider_name)} <i class="fa-solid fa-external-link-alt" style="font-size:0.7rem; opacity:0.7;"></i>
          </a>
        </div>
      ` : ''}

      <div class="modal-metric-grid">
        <div class="modal-metric">
          <div class="modal-metric-val">${gpus}</div>
          <div class="modal-metric-lbl">Total GPUs</div>
        </div>
        <div class="modal-metric">
          <div class="modal-metric-val">${bw}</div>
          <div class="modal-metric-lbl">Network BW</div>
        </div>
        <div class="modal-metric">
          <div class="modal-metric-val">${uptime}</div>
          <div class="modal-metric-lbl">SLA Uptime</div>
        </div>
        <div class="modal-metric">
          <div class="modal-metric-val" style="${!provider.price_per_gpu_hour_usd ? 'font-size:0.9rem; color:var(--text-secondary);' : ''}">${priceVal}</div>
          <div class="modal-metric-lbl">${priceLabel}</div>
        </div>
      </div>

      <div style="margin-bottom:18px;">
        <div class="modal-section-title">Hardware Architectures</div>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          ${hw || '<span style="font-size:0.78rem; color:var(--text-secondary);">Not disclosed</span>'}
        </div>
      </div>

      <div style="margin-bottom:18px;">
        <div class="modal-section-title">Infrastructure</div>
        <div style="background:var(--bg-inner); border:1px solid var(--border); border-radius:10px; padding:2px 14px;">
          <div class="infra-row"><span class="infra-key">Interconnect</span><span class="infra-val">${provider.interconnect || 'Not disclosed'}</span></div>
          <div class="infra-row"><span class="infra-key">Cooling</span><span class="infra-val">${provider.cooling_type || 'Not disclosed'}</span></div>
          <div class="infra-row"><span class="infra-key">Jurisdiction</span><span class="infra-val">${provider.jurisdiction_zone || 'Not disclosed'}</span></div>
          <div class="infra-row"><span class="infra-key">Location</span><span class="infra-val">${provider.primary_location || 'Not disclosed'}</span></div>
        </div>
      </div>

      <div style="margin-bottom:18px;">
        <div class="modal-section-title">Certifications &amp; Compliance</div>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">${certs}</div>
      </div>

      <div style="background:var(--bg-inner); border:1px solid var(--border); border-radius:10px; padding:12px 14px;">
        <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-bottom:${provider.notes ? '8px' : '0'};">
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:0.6rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-secondary); font-weight:600;">Price data</span>
            ${freshnessTag(quality, provider.last_verified)}
          </div>
          <div style="font-size:0.72rem; color:var(--text-secondary);">
            <span style="font-size:0.6rem; text-transform:uppercase; letter-spacing:0.08em; font-weight:600; margin-right:4px; opacity:0.6;">Last pulled</span>${verifiedText}
          </div>
        </div>
        ${provider.notes ? `<div style="font-size:0.72rem; color:var(--text-secondary); font-style:italic; padding:8px 0; border-top:1px solid var(--border);">"${provider.notes}"</div>` : ''}

        ${provider.website ? `
          <div style="margin-top:10px;">
            <a href="${provider.website}" target="_blank" rel="noopener" 
               style="display:inline-flex; align-items:center; gap:8px; background:var(--accent); color:white; padding:8px 16px; border-radius:8px; font-size:0.85rem; font-weight:600; text-decoration:none;">
              Visit Official Site <i class="fa-solid fa-external-link-alt" style="font-size:0.7rem;"></i>
            </a>
          </div>
        ` : ''}

        <div style="padding-top:8px; border-top:1px solid var(--border); margin-top:8px;">
          <span style="font-size:0.6rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-secondary); font-weight:600; margin-right:6px;">Sources</span>
          ${sourcesHTML}
        </div>
      </div>
    `;
  }

  // Public API
  return {
    createProviderCard,
    createFilterSection,
    renderModalContent,
    LAYER_CLASS
  };

})();
