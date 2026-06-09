# FlopSource — AI Compute Directory Roadmap

**Status:** Active Product Direction (as of mid-2026)  
**Focus:** Professional B2B discovery platform + lead generation funnel for AI compute infrastructure. Primary entry is the marketing landing page at flopsource.com, with the serious directory tool at the /website path.

---

## Vision

A clean, trustworthy, and highly usable directory that helps enterprise buyers (CTOs, infrastructure leads, CFOs) quickly discover, filter, and evaluate AI compute providers based on technical, commercial, and compliance criteria.

Core values:
- **Data quality over quantity**
- **Transparency** (clear sourcing and freshness indicators)
- **Simplicity** — fast to use, easy to maintain
- **Corporate-appropriate** design and tone

---

## Current State (May 2026)

### Delivered
- Fully functional static frontend (vanilla ES6 + Tailwind CDN)
- Powerful client-side filtering (Layer Type, Hardware Architecture, Cooling, Jurisdiction + text search)
- Responsive card grid + rich detail modal; keyboard-accessible (tabindex, role, focus-visible)
- Sorting (name, GPU count, price, last verified)
- Use-case sorter on main page — sorts results by Best In Class score for a chosen workload type
- Data quality badges, last verified dates, and source links in UI
- Context-aware empty state with specific guidance and separate "Clear search" button
- Complete data pipeline (`data-pipeline/`)
  - Modular scraper architecture with Pydantic schema
  - High-quality manual/research-backed data
  - Easy Windows launchers (`run-pipeline.bat` / `.ps1`)
  - `manual_overrides.json` — supports field overrides, `_skip` to exclude providers, `_add_providers` to inject new records
- 29 real providers — all high or medium quality, zero synthetic fakes (21 high, 8 medium)
- Local development serving scripts; S3 Express deployment script (`deploy.sh`)
- Enterprise comparison tool — up to 10 providers, 5 weighted categories, use-case selector, AI-driven ranking highlights, Save/Share export
- Conversational AI Consultation widget (floating chatbot, bottom-right)
- AI analysis powered by Cloudflare Workers AI (Llama 3.3 70B) — no user keys required
- Dark/light theme toggle; draggable floating comparison tray
- **Lead Generation System** (current major focus):
  - Marketing landing page at root (`index.html`) as primary entry point
  - Affiliate programs page at root (`affiliates.html`) — real monetary value only
  - Shared `lead-gate.js` module
  - Email grabber gating the AI Consultation button immediately
  - "After 3 comparisons" rule that triggers email capture on the 4th comparison attempt

### Known Limitations / Gaps

- Dataset is strictly limited to 29 real providers (intentional — quality and honesty over quantity)
- No structured usage logging yet for comparisons or AI consultations (decision made to implement via existing Worker + D1 for best effectiveness + minimal perf impact)
- Hosting split is still maturing (Bluehost for landing, AWS planned for the tool)
- No automated pipeline refresh (manual run required)
- No custom domain / full production hosting yet

---

## Guiding Principles

1. **Prioritize usability and trust** over flashy features.
2. **Data strategy** will be hybrid (manual + targeted scraping) for the foreseeable future.
3. **Keep the tech stack simple** as long as it serves the product well (avoid premature framework adoption).
4. **Make maintenance sustainable** — the directory is only as good as its data freshness and accuracy.

---

## Phase 1: Functionality Polish — COMPLETE ✓

**Goal:** Make the existing experience feel complete, reliable, and professional before adding significant new features or many more providers.

All Phase 1 items are complete. See [PHASE1.md](./PHASE1.md) for the full task history.

---

## Current Focus: Marketing Landing + Lead Generation (Mid-2026)

**Goal**: Turn the root `index.html` into the primary funnel while protecting the serious tool behind fair, non-intrusive lead capture.

### Delivered
- Root `index.html` as the main marketing site (hero, honest stats using real 29-provider data, "Why this matters", For Providers section with dual pathways)
- `affiliates.html` at root — clean, low-hype reference page showing only programs with real monetary rewards
- Email grabber (`lead-gate.js`) gating the prominent AI Consultation floating button
- "After 3 comparisons" gating on the powerful comparison tool (4th attempt triggers email capture)
- Subtle but visible "Affiliate Programs" internal link (brighter + larger styling) under the selective text in For Providers
- Clear architectural split: marketing surface (root) vs. professional directory tool (`website/flopsourcedirectory.html`)
- All links, logo navigation, and serve scripts updated for the new structure
- Decision on future logging: extend the existing Cloudflare Worker + D1 (highest signal, near-zero client perf cost)

### Next in This Phase
- Implement rich logging via the Worker + D1 (comparisons + AI events, tied to captured emails where available)
- Add lightweight stats view or export for captured leads (once logging exists)
- Refine the email grabber copy and timing based on real usage
- Ensure lead-gen features never damage trust or the professional tone of the directory tool

This phase directly supports the three goals: Awareness + Trial, Thought Leadership / Trust, and Lead Gen + Affiliate pipelines.

### Completed

- All broken interactions fixed (modal, filters, empty state, search)
- Mobile/responsive filter experience
- Loading states, error states, Refresh Data
- Sorting, active filter chips, use-case sorter (Best In Class scoring)
- Data quality badges, freshness footer, source links
- Pipeline resilience and clean logging
- Enterprise comparison tool (10 providers, 5 weighted categories, AI analysis, Save/Share)
- AI Consultation widget (conversational floating chatbot)
- Keyboard accessibility for cards and filter pills
- Context-aware empty state guidance
- `manual_overrides.json` expanded (`_skip`, `_add_providers`, schema docs)
- Comparison module split complete (comparison.js owns all modal + tray logic)
- Full documentation update

---

## Phase 2: Data Maturity & Controlled Expansion — IN PROGRESS

**Goal:** Grow the dataset while maintaining high trust and data quality.

### Done

- Removed all 37 fake placeholder providers (Nexlify-49 etc.) from the dataset
- 29 real providers now live (21 high, 8 medium quality)

### Remaining Priorities

- Continue expanding real provider coverage — target 40–60 high-signal providers
- Improve data depth on existing 8 medium-quality entries (fill in missing fields)
- Decide on scraper vs curated manual data strategy going forward
- Add more provenance/freshness visibility in UI
- Establish explicit data quality acceptance criteria

### Open Strategic Questions

- How much effort should go into real scrapers vs curated manual data?
- Should we accept community-submitted data? (with review process)
- What is our tolerance for estimated / lower-quality entries?

---

## Phase 3: Feature Expansion

Only after Phase 1 and a solid data foundation.

Possible features (prioritization TBD):
- Provider comparison mode (select 2–4 cards)
- Advanced filters (price range sliders, minimum GPU count, specific certifications)
- "Saved views" / shareable filtered links (client-side only)
- Export filtered results (CSV / JSON)
- Provider "request a quote" or lead capture flow (form or mailto)
- On-site "Suggest an update" for individual fields
- Dark mode (low priority)
- Saved favorites (localStorage)

---

## Phase 4: Production Readiness & Hosting

### Hosting Reality

- Current bucket: `flopsource-compute-directory` (S3 Express One Zone).
- S3 Express One Zone has limitations for static website hosting.
- Recommended path: CloudFront in front of this S3 Express bucket, or a move to a regular S3 bucket + CloudFront.

### Tasks
- Proper CloudFront setup with correct cache headers and origin configuration
- Custom domain + ACM certificate
- Basic monitoring / uptime checks
- Performance budget and Lighthouse targets
- SEO considerations (meta, sitemap, structured data?)

---

## Phase 5: Operations & Long-term Sustainability

- Automated nightly/weekly data refresh pipeline (GitHub Actions or similar)
- Data freshness dashboard or visible "last pipeline run" indicator
- Versioning of the data JSON (for rollback)
- Lightweight admin / override interface (optional future)
- Clear ownership and maintenance responsibilities

---

## Success Metrics (Examples)

- Time to find relevant providers for a typical buyer
- % of providers with "high" data quality rating
- Data freshness (average days since last verified)
- User retention / return visits (once analytics are added)
- Ease of maintenance (time to add/update a provider)

---

## Risks & Trade-offs

- **Data staleness** — GPU availability and pricing change fast. We must set realistic expectations in the UI.
- **Maintenance burden** — Manual data requires ongoing effort.
- **Scope creep** — Easy to want "just one more feature."
- **Hosting complexity** — S3 Express + CloudFront has nuances.

---

## Next Steps (Immediate)

1. Implement server-side logging for comparisons and AI consultations (via existing Worker + D1 — highest effectiveness, lowest performance cost).
2. Add basic lead visibility / export once logging is live.
3. Continue refining the marketing landing + email grabber experience (copy, timing, fairness).
4. Maintain the strict "29 real providers only" data discipline.
5. Move directory hosting to proper S3 + CloudFront when ready.

---

*This is a living document. Update it as priorities and learnings evolve.*

**Last updated:** June 2026 (major updates: root marketing landing as primary entry, email lead-gen gating on AI Consultation + after 3 comparisons, 29 real providers only, logging strategy decision, Phase 2 data work in progress)
