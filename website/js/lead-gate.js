/**
 * lead-gate.js
 * FlopSource — Shared email lead capture (grabber) + usage-based gating
 *
 * Used to:
 *   - Gate the floating "AI Consultation" button (immediate capture)
 *   - Gate the Comparison tool after the user has performed 3 comparisons
 *     ("After the user does three comparisons site should prompt for email")
 *
 * All state is client-side (localStorage) for now. Easy to extend later
 * to POST the email to your Cloudflare Worker / backend on capture.
 *
 * Loaded early so comparison.js, ai-widget.js, and app.js can all rely on it.
 */
(() => {
  'use strict';

  const LEAD_EMAIL_KEY = 'flopsource_lead_email';
  const COMPARISON_COUNT_KEY = 'flopsource_comparison_count';

  // After this many completed comparison sessions, the NEXT attempt to open
  // the comparison UI will first show the email grabber.
  const COMPARISON_GATE_THRESHOLD = 3;

  // ── Pure helpers ──────────────────────────────────────────────────────────────

  function hasCapturedEmail() {
    return !!localStorage.getItem(LEAD_EMAIL_KEY);
  }

  function getCapturedEmail() {
    return localStorage.getItem(LEAD_EMAIL_KEY);
  }

  function captureEmail(raw) {
    const email = (raw || '').trim().toLowerCase();
    if (email) localStorage.setItem(LEAD_EMAIL_KEY, email);
    return email;
  }

  function isValidEmail(raw) {
    const email = (raw || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function getComparisonCount() {
    const raw = localStorage.getItem(COMPARISON_COUNT_KEY);
    const n = parseInt(raw || '0', 10);
    return Number.isNaN(n) ? 0 : n;
  }

  function recordComparisonUse() {
    const next = getComparisonCount() + 1;
    localStorage.setItem(COMPARISON_COUNT_KEY, String(next));
    return next;
  }

  function shouldPromptEmailForComparison() {
    return !hasCapturedEmail() && getComparisonCount() >= COMPARISON_GATE_THRESHOLD;
  }

  // ── Modal (reused for both AI button and post-3-comparisons prompt) ───────────

  function showEmailCaptureModal(onSuccess) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.65);display:flex;align-items:center;justify-content:center;z-index:500;padding:20px;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:var(--bg-surface);border:1px solid var(--border-md);border-radius:16px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.35);overflow:hidden;font-family:inherit;';

    modal.innerHTML = `
      <div style="padding:16px 18px 12px; border-bottom:1px solid var(--border-md); display:flex; align-items:center; justify-content:space-between; background:var(--bg-inner);">
        <div style="font-weight:600; font-size:0.95rem; display:flex; align-items:center; gap:8px; color:var(--text-primary);">
          <i class="fa-solid fa-comments" style="color:var(--accent);"></i>
          <span>AI Consultation</span>
        </div>
        <button id="gate-close" class="btn-ghost" style="width:28px;height:28px;font-size:16px;padding:0;line-height:1;opacity:0.7;" aria-label="Close">×</button>
      </div>
      <div style="padding:18px 20px 6px;">
        <div style="font-size:0.88rem; line-height:1.4; color:var(--text-primary); margin-bottom:10px;">
          Get personalized recommendations from our AI infrastructure consultant.
        </div>
        <input id="gate-email" type="email" placeholder="you@company.com" autocomplete="email" style="
          width:100%; padding:10px 12px; font-size:0.9rem; border:1px solid var(--border-md); border-radius:10px;
          background:var(--bg-inner); color:var(--text-primary); outline:none; box-sizing:border-box;
        " />
        <div id="gate-error" style="font-size:0.72rem; color:#f87171; margin-top:6px; min-height:1em; display:none;"></div>
        <div style="font-size:0.66rem; color:var(--text-muted); margin-top:10px; line-height:1.35;">
          We only use this to deliver your recommendations and occasional high-signal updates. No spam.
        </div>
      </div>
      <div style="padding:12px 18px 16px; background:var(--bg-inner); border-top:1px solid var(--border-md); display:flex; justify-content:flex-end; gap:8px;">
        <button id="gate-cancel" class="btn-ghost" style="font-size:0.82rem; padding:6px 14px;">Cancel</button>
        <button id="gate-submit" class="btn" style="font-size:0.82rem; padding:6px 18px; font-weight:600;">Start Consultation</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const input = modal.querySelector('#gate-email');
    const errorEl = modal.querySelector('#gate-error');
    const submitBtn = modal.querySelector('#gate-submit');
    const closeBtn = modal.querySelector('#gate-close');
    const cancelBtn = modal.querySelector('#gate-cancel');

    const close = () => { overlay.remove(); };

    closeBtn.onclick = close;
    cancelBtn.onclick = close;

    function submit() {
      const val = input.value;
      if (!isValidEmail(val)) {
        errorEl.textContent = 'Please enter a valid email address.';
        errorEl.style.display = 'block';
        input.style.borderColor = '#f87171';
        input.focus();
        return;
      }
      errorEl.style.display = 'none';
      input.style.borderColor = '';
      captureEmail(val);

      // Fire-and-forget: log lead to Cloudflare Worker (visible in CF Dashboard → Workers → Logs).
      fetch('https://flopsourceadvisor.synaptiqs.workers.dev/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: val.trim().toLowerCase(), source: 'ai-consultation', ts: Date.now() })
      }).catch(() => {});

      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Opening…';
      setTimeout(() => {
        close();
        if (typeof onSuccess === 'function') onSuccess();
      }, 160);
    }

    submitBtn.onclick = submit;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
      if (e.key === 'Escape') close();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    setTimeout(() => {
      input.focus();
      input.select();
    }, 70);
  }

  function requireThen(onSuccess) {
    if (hasCapturedEmail()) {
      if (typeof onSuccess === 'function') onSuccess();
      return;
    }
    showEmailCaptureModal(onSuccess);
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  const LeadGate = {
    // Email
    hasEmail: hasCapturedEmail,
    getEmail: getCapturedEmail,
    captureEmail,
    isValidEmail,
    requireThen,
    showEmailCaptureModal,   // exposed for advanced use / testing

    // Comparison usage tracking ("after three comparisons → prompt")
    getComparisonCount,
    recordComparisonUse,
    shouldPromptEmailForComparison,
    COMPARISON_THRESHOLD: COMPARISON_GATE_THRESHOLD,

    // Convenience for comparison path
    requireEmailForComparison(onSuccess) {
      if (hasCapturedEmail() || getComparisonCount() < COMPARISON_GATE_THRESHOLD) {
        if (typeof onSuccess === 'function') onSuccess();
        return;
      }
      requireThen(onSuccess);
    }
  };

  // Expose globally as early as possible
  window.FlopSourceLeadGate = window.FlopSourceLeadGate || LeadGate;

  // Also expose a tiny alias for convenience in console / future scripts
  window.FlopSource = window.FlopSource || {};
  window.FlopSource.lead = window.FlopSource.lead || LeadGate;
})();