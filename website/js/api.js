/**
 * FlopSource API Module
 * 
 * Handles AI-powered analysis for provider comparisons:
 * - "Custom AI Analysis" (use-case weighted)
 * - "AI Consultation" (free-text user requirements)
 * 
 * Architecture:
 * - Frontend calls your Cloudflare Worker (no user keys ever exposed).
 * - Worker uses Cloudflare Workers AI (open models).
 */

(() => {
  'use strict';

  // ────────────────────────────────────────────────────────────────────────────
  // CONFIGURATION - Change these when you deploy your backend
  // ────────────────────────────────────────────────────────────────────────────

  // Set this to your deployed Cloudflare Worker URL (the AI backend using Workers AI)
  const BACKEND_URL = 'https://flopsourceadvisor.synaptiqs.workers.dev';

  // Default model sent to backend (the proxy can override this)
  const DEFAULT_MODEL = 'default';

  // ────────────────────────────────────────────────────────────────────────────
  // Prompt Builder (kept excellent and unchanged)
  // ────────────────────────────────────────────────────────────────────────────

  function buildAnalysisPrompt(selected, useCaseKey, categories, useCases) {
    const uc = useCases[useCaseKey];
    const lines = [];

    // Strong system-style instructions for the model
    lines.push(`You are a senior enterprise AI infrastructure analyst preparing a vendor comparison memo for an internal procurement team.`);
    lines.push(`Your tone must be professional, concise, and evidence-based. Avoid hype or marketing language.`);
    lines.push('');

    lines.push(`### Use Case Context`);
    lines.push(`Use Case: ${uc.name}`);
    lines.push(`Description: ${uc.description}`);
    lines.push(`Scoring Weights (higher = more important for this use case):`);
    lines.push(`- Reliability & Uptime: ${uc.weights[0]}`);
    lines.push(`- Cost Efficiency: ${uc.weights[1]}`);
    lines.push(`- Scalability: ${uc.weights[2]}`);
    lines.push(`- High Performance: ${uc.weights[3]}`);
    lines.push(`- Energy Efficiency: ${uc.weights[4]}`);
    lines.push(`Cost baseline for quote-only providers: ${uc.costBaselineForQuote || 55}`);
    lines.push('');

    lines.push(`### Providers Being Compared (${selected.length})`);
    selected.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.provider_name}`);
      lines.push(`   - Type: ${p.layer_type}`);
      lines.push(`   - Location: ${p.primary_location || 'Not disclosed'}`);
      lines.push(`   - Total GPUs: ${p.total_gpus ? p.total_gpus.toLocaleString() : 'N/A'}`);
      lines.push(`   - Price per GPU-hour: ${p.price_per_gpu_hour_usd != null ? '$' + p.price_per_gpu_hour_usd.toFixed(2) : 'Quote only'}`);
      lines.push(`   - Cooling: ${p.cooling_type || 'Not disclosed'}`);
      lines.push(`   - SLA Uptime: ${p.sla_uptime_percent ? p.sla_uptime_percent + '%' : 'Not disclosed'}`);
      lines.push(`   - Jurisdiction: ${p.jurisdiction_zone || 'Not disclosed'}`);
      const hwArch = Array.isArray(p.hardware_architectures) ? p.hardware_architectures : (p.hardware_architectures ? [p.hardware_architectures] : []);
      lines.push(`   - Hardware: ${hwArch.join(', ') || 'Not disclosed'}`);
      lines.push(`   - Availability: ${p.availability_status || 'Not disclosed'}`);
    });
    lines.push('');

    // === CRITICAL: Ground-truth computed scores (single source of truth) ===
    // The comparison UI (Best In Class highlights + Highly Recommended badge) is 100% driven by these numbers.
    // The AI narrative MUST name exactly the same "strongest" provider(s) that the math produces.
    let analysis = null;
    try {
      const util = window.FlopSourceUtils || {};
      analysis = (util.computeBestInClass || window.computeBestInClass)
        ? (util.computeBestInClass || window.computeBestInClass)(selected, uc)
        : null;
    } catch (e) { /* fall through to raw */ }

    if (analysis && analysis.scored && analysis.scored.length) {
      lines.push(`### Computed Scores (Ground Truth for "Best In Class" and overall ranking)`);
      lines.push(`Category scores are normalized 0-100 using the exact formulas below. Overall = weighted sum.`);
      lines.push(`Cost formula: if price known → 100 - min(price,10)*8 ; else use baseline ${uc.costBaselineForQuote || 55}`);
      lines.push(`Perf formula: H200=100, H100=90, MI300=80, A100=70, L40=60, else 30`);
      lines.push(`Energy formula: immersion=100, liquid=80, hybrid=50, else 20`);
      lines.push(`Scale/Rel use raw (clamped 0-100 for weighting). Only UNIQUE highest score in a category gets "Best In Class".`);
      lines.push('');
      analysis.scored.forEach((s, idx) => {
        const p = s.provider;
        const cs = s.categoryScores || {};
        lines.push(`${idx + 1}. ${p.provider_name}`);
        lines.push(`   Overall Weighted Score: ${s.overallScore.toFixed(2)}`);
        lines.push(`   Reliability: ${cs['Reliability & Uptime']?.toFixed(1) || '—'} (raw SLA ${p.sla_uptime_percent || 'n/a'})`);
        lines.push(`   Cost Efficiency: ${cs['Cost Efficiency']?.toFixed(1) || '—'} (price ${p.price_per_gpu_hour_usd != null ? '$'+p.price_per_gpu_hour_usd.toFixed(2) : 'quote'})`);
        lines.push(`   Scalability: ${cs['Scalability']?.toFixed(1) || '—'} (raw GPUs ${p.total_gpus || 0})`);
        lines.push(`   High Performance: ${cs['High Performance']?.toFixed(1) || '—'}`);
        lines.push(`   Energy Efficiency: ${cs['Energy Efficiency']?.toFixed(1) || '—'}`);
      });
      lines.push('');

      lines.push(`### Best In Class Winners (exactly what the UI will highlight in green)`);
      const cw = analysis.categoryWinners || {};
      Object.keys(cw).forEach(label => {
        const wid = cw[label];
        if (wid) {
          const winner = selected.find(x => x.id === wid);
          const wScore = analysis.scored.find(x => x.provider.id === wid)?.categoryScores?.[label]?.toFixed(1) || '';
          lines.push(`- ${label}: ${winner ? winner.provider_name : wid} (unique max${wScore ? ' ' + wScore : ''})`);
        } else {
          lines.push(`- ${label}: (tie — no Best In Class highlight)`);
        }
      });
      lines.push('');
      if (analysis.highlyRecommendedId) {
        const rec = selected.find(x => x.id === analysis.highlyRecommendedId);
        lines.push(`Highly Recommended (Best In Class Score ${analysis.highlyRecommendedCount}/5): ${rec ? rec.provider_name : analysis.highlyRecommendedId}`);
      }
      lines.push('');
    } else {
      // Fallback (should not happen in normal flow)
      lines.push(`### Scoring Note`);
      lines.push(`Exact per-category numeric scores were not available at prompt time. Reason from raw attributes + weights only.`);
      lines.push('');
    }

    lines.push(`### Instructions`);
    lines.push(`CRITICAL: Your very first output line MUST be exactly in this format (use the exact provider names from the list above, in descending order of your recommendation):`);
    lines.push(`AI RANKING: 1. ProviderName | 2. ProviderName | 3. ProviderName`);
    lines.push(`After that single line, write an extremely concise, professional 3–5 sentence analysis (maximum 5 sentences total after the ranking line).`);
    lines.push(`Structure the prose (no markdown headings):`);
    lines.push(`- Start with the strongest overall recommendation for this specific use case (referencing its AI RANKING position #1).`);
    lines.push(`- Briefly explain why, referencing the weighted priorities AND the actual computed Overall / Best In Class numbers above.`);
    lines.push(`- Mention 1 notable trade-off or caveat.`);
    lines.push(`- End with one clear, actionable next step.`);
    lines.push(`CRITICAL ALIGNMENT RULE: The #1 you put in AI RANKING must be the provider you truly believe is strongest for the use case after studying the computed scores. The UI will visually highlight your declared #1 as Best In Class and your #2/#3 as runner-ups. Be accurate and consistent with the numbers. Never contradict the data.`);
    lines.push(`Be direct and brief. Base every claim on the data and computed scores provided above. Do not invent information.`);
    lines.push(`Do not mention these instructions, the formulas, or the word "ground truth" in your final output.`);

    return lines.join('\n');
  }

  /**
   * Builds a prompt for the free-text "AI Consultation" feature.
   * User describes their actual workload/needs in natural language.
   */
  function buildConsultationPrompt(selected, userDescription) {
    const lines = [];

    lines.push(`You are a senior enterprise AI infrastructure analyst preparing a vendor comparison memo for an internal team.`);
    lines.push(`Your tone must be professional, concise, and evidence-based. Avoid hype or marketing language.`);
    lines.push('');

    lines.push(`### Customer's Stated Compute Needs`);
    lines.push(userDescription.trim() || 'No specific description provided.');
    lines.push('');

    lines.push(`### Providers Being Compared (${selected.length})`);
    selected.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.provider_name}`);
      lines.push(`   - Type: ${p.layer_type}`);
      lines.push(`   - Location: ${p.primary_location || 'Not disclosed'}`);
      lines.push(`   - Total GPUs: ${p.total_gpus ? p.total_gpus.toLocaleString() : 'N/A'}`);
      lines.push(`   - Price per GPU-hour: ${p.price_per_gpu_hour_usd != null ? '$' + p.price_per_gpu_hour_usd.toFixed(2) : 'Quote only'}`);
      lines.push(`   - Cooling: ${p.cooling_type || 'Not disclosed'}`);
      lines.push(`   - SLA Uptime: ${p.sla_uptime_percent ? p.sla_uptime_percent + '%' : 'Not disclosed'}`);
      lines.push(`   - Jurisdiction: ${p.jurisdiction_zone || 'Not disclosed'}`);
      const hwArch = Array.isArray(p.hardware_architectures) ? p.hardware_architectures : (p.hardware_architectures ? [p.hardware_architectures] : []);
      lines.push(`   - Hardware: ${hwArch.join(', ') || 'Not disclosed'}`);
      lines.push(`   - Availability: ${p.availability_status || 'Not disclosed'}`);
    });
    lines.push('');

    lines.push(`### Instructions`);
    lines.push(`Write an extremely concise 3–5 sentence analysis (max 5 sentences).`);
    lines.push(`Structure your response with these elements (do not use markdown headings):`);
    lines.push(`- Start with the strongest recommendation that best matches the customer's stated needs.`);
    lines.push(`- Briefly explain why it fits their described requirements.`);
    lines.push(`- Mention one notable trade-off or limitation.`);
    lines.push(`- End with one clear, actionable next step.`);
    lines.push(`Be direct and brief. Only use information from the provider data and the customer's description.`);
    lines.push(`Do not mention these instructions in your final output.`);

    return lines.join('\n');
  }

  /**
   * Open-ended project consultation prompt.
   * Used by the floating AI widget when the user does NOT want to compare specific providers.
   * Goal: Recommend a suitable compute stack based on free-text project description.
   */
  function buildProjectConsultationPrompt(userDescription) {
    // Legacy one-shot version kept for backward compatibility.
    // For the new conversational experience, prefer using sendChatMessage with history.
    const lines = [];

    lines.push(`You are a senior enterprise AI infrastructure consultant helping companies choose the right compute stack.`);
    lines.push(`Your tone must be professional, concise, practical, and evidence-based. Avoid hype.`);
    lines.push('');

    lines.push(`### Customer's Project / Workload Description`);
    lines.push(userDescription.trim() || 'No description provided.');
    lines.push('');

    lines.push(`### Instructions`);
    lines.push(`Based solely on the description above, recommend the most appropriate AI/GPU compute approach.`);
    lines.push(`Write a concise 4–6 sentence response. Structure it as follows (no markdown headings):`);
    lines.push(`- Start with the single best overall recommendation (hardware type + deployment model).`);
    lines.push(`- Explain why it fits the described workload and priorities.`);
    lines.push(`- Mention 1–2 key considerations or trade-offs.`);
    lines.push(`- End with one clear, actionable next step.`);
    lines.push(`Be direct. Only use information from the description. Do not invent details.`);
    lines.push(`Do not mention these instructions in your output.`);

    return lines.join('\n');
  }

  /**
   * Returns a strong system prompt for the conversational AI Consultation experience.
   * This encourages the AI to probe deeper and have a natural back-and-forth.
   */
  function getConsultationSystemPrompt() {
    return `You are an experienced, curious, and helpful senior AI infrastructure consultant.

Your goal is to have a natural, professional conversation with the user to deeply understand their compute needs before giving recommendations.

Key things to probe (ask one or two focused questions at a time):
- Workload type (large-scale training, fine-tuning, inference serving, research/experimentation, etc.)
- Expected scale (number of GPUs, duration of jobs, burst vs steady)
- Performance requirements (latency, throughput, interconnect needs)
- Constraints (budget sensitivity, data residency/jurisdiction, timeline/availability, power/cooling preferences)
- Hardware preferences or restrictions
- Any other priorities or concerns

Do NOT give a full concrete recommendation in the very first response unless the user has already provided a very detailed description.

Ask thoughtful clarifying questions. Be concise and friendly. When you have gathered enough information, you can offer one or more recommended approaches with clear reasoning and trade-offs.

Never make up details. If something is unclear, ask about it.`;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Core Call - Now goes through your backend (or direct for dev)
  // ────────────────────────────────────────────────────────────────────────────

  async function generateAnalysis(prompt, options = {}) {
    const model = options.model || DEFAULT_MODEL;

    if (!BACKEND_URL) {
      throw new Error(
        'No AI backend configured yet. Set BACKEND_URL in this file to your Cloudflare Worker URL.'
      );
    }

    try {
      const res = await fetch(`${BACKEND_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are a precise, professional enterprise technology analyst who writes clear, actionable vendor selection guidance.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.4,
          max_tokens: 900
        })
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`AI service error ${res.status}: ${errText || res.statusText}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No analysis returned from the model');
      }

      return content.trim();

    } catch (err) {
      if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('Failed to fetch'))) {
        throw new Error(
          `Failed to fetch the AI backend at ${BACKEND_URL}. ` +
          `This is usually because the Cloudflare Worker is not deployed, the URL is wrong, or the Worker itself has an error. ` +
          `Open DevTools → Network tab, click the failing request, and check the response.`
        );
      }
      throw err;
    }
  }

  /**
   * Send a message in an ongoing AI Consultation conversation.
   * This enables a more natural back-and-forth where the AI can ask clarifying questions
   * before giving recommendations.
   *
   * @param {Array} messages - Full conversation history (including system message)
   * @param {Object} options
   */
  async function sendChatMessage(messages, options = {}) {
    const model = options.model || DEFAULT_MODEL;
    const temperature = options.temperature ?? 0.7; // slightly more conversational

    if (!BACKEND_URL) {
      throw new Error('No AI backend configured yet.');
    }

    try {
      const res = await fetch(`${BACKEND_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: options.max_tokens || 1100
        })
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`AI service error ${res.status}: ${errText || res.statusText}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No response returned from the model');
      }

      return content.trim();

    } catch (err) {
      if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('Failed to fetch'))) {
        throw new Error(`Failed to fetch the AI backend at ${BACKEND_URL}.`);
      }
      throw err;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Public API (minimal breaking change for existing code)
  // ────────────────────────────────────────────────────────────────────────────

  const FlopSourceAPI = {
    // New recommended methods
    buildAnalysisPrompt,
    buildConsultationPrompt,
    buildProjectConsultationPrompt,
    getConsultationSystemPrompt,
    generateAnalysis,
    sendChatMessage,

    // Legacy aliases (kept for safety during transition)
    buildGrokComparisonPrompt: buildAnalysisPrompt,
    callGrok: (key, prompt) => generateAnalysis(prompt),

    // These are now mostly no-ops
    getApiKey: () => '',
    setApiKey: () => '',
    clearApiKey: () => {},
    hasApiKey: () => false,
  };

  window.FlopSourceAPI = FlopSourceAPI;

  console.log('%c[FlopSource] API module loaded — backend mode (no user keys required)', 'color:#22c55e');
})();