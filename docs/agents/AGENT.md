# FlopSource — AI Agent / Coding Assistant Context

## Project Overview

FlopSource is a professional B2B directory and comparison platform for enterprise AI compute infrastructure. It helps technical buyers (CTOs, infrastructure teams, procurement, and engineering leaders) discover, evaluate, and compare GPU clouds, bare-metal providers, and edge nodes.

The product focuses on **transparency, technical depth, and decision support** rather than hype or marketing. It combines structured data, weighted scoring by real use cases, and AI-powered analysis.

## Target Audience

- Technical decision makers at mid-to-large companies running or planning AI workloads
- Infrastructure, MLOps, and procurement teams
- People who are tired of vendor sales pitches and want clear, comparable data

## Core Positioning & Value

- **Not another cloud marketplace** — A focused, trustworthy evaluation tool.
- Strong emphasis on **use-case-specific ranking** (Training, Inference, Fine-Tuning, Research, Balanced).
- Features "Best In Class" scoring using real weighted criteria instead of marketing claims.
- AI features (analysis + consultation) are provided as a service by the owner (no user API keys required).
- Data is curated with clear sourcing and verification dates.

## Brand Voice & Tone

- Professional, direct, and evidence-based
- Avoids marketing language and hype
- Practical and decision-oriented
- Clear and concise

**Never** sound like a startup trying to "disrupt" or "revolutionize" the space. The tone is closer to a serious industry analyst or internal tools team.

## Key Technical Details

- **Frontend**: Vanilla JavaScript (modular architecture in `website/js/`), Tailwind CSS
- **Marketing Landing (Primary Entry Point)**: Root `index.html` — hero, stats, value props, "For Providers" section with lead-gen CTAs
- **Directory Tool**: `website/flopsourcedirectory.html` (the full filtered grid + comparison + AI features)
- **Data**: `website/data/data_centers.json` (exactly 29 real providers only — strict "no lying" policy). Managed by Python pipeline in `data-pipeline/`
- **AI Backend**: Cloudflare Worker (`workers/ai-proxy.js`) — OpenAI-compatible `/chat/completions`. Powers both one-shot AI Analysis and conversational AI Consultation. No user API keys ever required.
- **Lead Generation System** (current major focus):
  - Shared module `website/js/lead-gate.js` (loaded early)
  - Email grabber gates the floating "AI Consultation" button on first use
  - "After 3 comparisons" rule: 4th comparison attempt triggers the same email capture modal first
  - Emails stored in localStorage (`flopsource_lead_email`) for now; comparison count in `flopsource_comparison_count`
  - Subtle "Affiliate Programs" link (brighter/larger styling) at bottom of For Providers section on landing page pointing to root `affiliates.html`
- Comparison limit: 10 providers
- Current provider count: Exactly 29 high-quality real providers (zero synthetic data)

## Important Principles When Working on FlopSource

- Prioritize **usability for buyers** over flashy features.
- Keep the interface clean and professional (avoid startup aesthetic).
- When adding AI features, focus on reducing research time and providing actionable insights.
- Data quality and transparency are core to the brand.
- The product has two surfaces: the serious directory tool and a cleaner marketing landing page.

## Current Priorities (as of latest context)

- **Lead Generation Funnel** (primary current thread):
  - Marketing landing page (`index.html`) as the main entry point driving awareness → trial (directory) → lead capture
  - Email grabber gating both the AI Consultation button and (after 3 uses) the powerful Comparison tool
  - Subtle but intentional "Affiliate Programs" pathway at the bottom of the For Providers section
- Strong comparison experience with use-case-based scoring and AI analysis (still core to the tool)
- Clear split between marketing surface (root) and the serious directory tool (`website/`)
- Maintaining a professional, low-hype, trustworthy tone — especially important around lead-gen features
- Honest data only (exactly 29 real providers, real GPU counts formatted correctly, no inflated numbers)

## When Helping With This Project

- Ask clarifying questions about whether a change belongs in the main directory (`website/`) or the marketing landing (root `index.html`).
- Default to practical improvements over visual flair unless specifically asked for design work.
- Respect the existing vanilla JS + modular architecture unless there's a strong reason to change it.
- When writing copy, use professional, straightforward language.
- Lead-gen features (email grabber, comparison gating, affiliate notes) must feel fair and non-intrusive. They should enhance trust, not damage it.

## Logging / Analytics (Recent Decision)

As of the latest work, the project has **no structured logging** of comparisons or AI consultations beyond minimal localStorage counters for the email gate UX.

**Preferred future approach** (chosen for best effectiveness + near-zero performance cost):
- Extend the existing Cloudflare Worker (`workers/ai-proxy.js`) to log rich events server-side.
- Use Cloudflare D1 (preferred) or KV for storage.
- Client-side: Use `navigator.sendBeacon` / `keepalive` fetch only for comparison events (AI events can be logged for free inside the Worker since requests already hit it).
- Goal: High-signal data (providers compared, use cases, conversation depth, conversion to email) without adding any heavy client scripts or hurting UX.

Update this section when implementation begins.