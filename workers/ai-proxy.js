/**
 * Cloudflare Worker - AI Proxy for FlopSource
 *
 * This worker powers the "Custom AI Analysis" and "AI Consultation" features.
 * It lets you offer professional provider analysis as a service
 * without ever asking users for their own API keys.
 *
 * Primary backend: Cloudflare Workers AI (env.AI) — no external keys required.
 * Fallbacks supported for Magica, OpenRouter, Groq if you prefer them.
 *
 * ========================================================================
 * MODEL SELECTION (critical - May 2026)
 * ========================================================================
 *
 * CORRECT current model for strong 70B-class analysis:
 *     @cf/meta/llama-3.3-70b-instruct-fp8-fast
 *
 * DO NOT USE:
 *     @cf/meta/llama-3.3-70b-instruct          ← does not exist (causes 5007 error)
 *     @cf/meta/llama-3.1-70b-instruct          ← scheduled for deprecation on 5/30/2026
 *
 * Official up-to-date list of all available Workers AI models:
 *     https://developers.cloudflare.com/workers-ai/models/
 *
 * You can also view available models directly in your Cloudflare Dashboard:
 * Workers & Pages → AI → Models
 *
 * The -fp8-fast suffix is REQUIRED for the Llama 3.3 70B variant.
 * ========================================================================
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint (GET /)
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response('FlopSource AI Worker is running', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders
      });
    }

    try {
      const body = await request.json();
      const { model, messages, temperature = 0.4, max_tokens = 900 } = body;

      // === PRIMARY PATH: Cloudflare Workers AI (recommended) ===
      if (env.AI) {
        // Use the safe, currently available 70B model by default
        const aiModel = (model && model !== 'default')
          ? model
          : '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

        const aiResponse = await env.AI.run(aiModel, {
          messages: messages || [{ role: 'user', content: 'Hello' }],
          temperature,
          max_tokens,
        });

        // Workers AI can return content in several shapes depending on the model.
        // This extraction is deliberately defensive.
        const content =
          aiResponse?.response ||
          aiResponse?.choices?.[0]?.message?.content ||
          (typeof aiResponse === 'string' ? aiResponse : '') ||
          '';

        return Response.json({
          id: crypto.randomUUID(),
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: aiModel,
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: content,
            },
            finish_reason: 'stop',
          }],
          usage: aiResponse?.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        }, { headers: corsHeaders });
      }

      // === FALLBACK PATHS (only used if env.AI is not available) ===

      let response;

      if (env.MAGICA_API_KEY) {
        const base = (env.MAGICA_BASE_URL || 'https://api.magica.com/api').replace(/\/$/, '');
        response = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.MAGICA_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model || 'default',
            messages,
            temperature,
            max_tokens
          }),
        });
      } else if (env.OPENROUTER_API_KEY) {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://flopsource.com',
            'X-Title': 'FlopSource AI Analysis',
          },
          body: JSON.stringify({
            model: model || 'deepseek/deepseek-r1:free',
            messages,
            temperature,
            max_tokens
          }),
        });
      } else if (env.GROQ_API_KEY) {
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model || 'llama-3.3-70b-versatile',
            messages,
            temperature,
            max_tokens
          }),
        });
      } else {
        return new Response(JSON.stringify({
          error: 'No AI provider configured. Enable Workers AI (env.AI) in this Worker or set one of the fallback keys (MAGICA_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY).'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        return new Response(JSON.stringify({ error: errorText }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || 'Worker error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },
};

/**
 * DEPLOYMENT INSTRUCTIONS
 *
 * 1. Go to Cloudflare Dashboard → Workers & Pages
 * 2. Create or edit your Worker (currently: flopsourceadvisor)
 * 3. Replace ALL code with this file
 * 4. Click "Save and Deploy"
 * 5. (Optional but recommended) Restrict CORS later:
 *      Change 'Access-Control-Allow-Origin': '*'  → your Bluehost domain
 *
 * No secrets/variables are required when using the native Workers AI path (env.AI).
 * The Worker will automatically use the best available open model.
 *
 * Test immediately after deploy by opening test-ai-backend.html locally in your browser
 * and clicking "Custom AI Analysis".
 *
 * The prompt engineering lives in website/js/api.js (buildAnalysisPrompt + buildConsultationPrompt).
 * That file does not need to change for model updates.
 *
 * BLUEHOST / PRODUCTION NOTE:
 * Before going live, restrict CORS:
 *   Change 'Access-Control-Allow-Origin': '*' 
 *   to your actual domain, e.g. 'https://flopsource.com'
 */