# FlopSource Project Structure (2026)

This repo is organized around a clear split between **marketing** and the **serious directory tool**, with a strong focus on lead generation.

## Current Folder Structure

```text
/FlopSource
├── index.html                    ← Primary entry point: Marketing landing page (hero, stats, value props, For Providers + lead-gen CTAs)
├── affiliates.html               ← Clean reference page for monetizable affiliate/referral programs only
├── website/                      ← The full directory application (the actual tool)
│   ├── index.html  ← Main app (filters, cards, comparison tray + modal, AI features) — deployed from the `website/` folder contents
│   ├── js/
│   │   ├── lead-gate.js          ← Shared email capture + "after 3 comparisons" gating logic
│   │   ├── ai-widget.js          ← Floating conversational AI Consultation
│   │   ├── comparison.js         ← Full comparison system (tray + modal + scoring)
│   │   └── ...
│   └── data/data_centers.json    ← Live data (exactly 29 real providers)
├── workers/                      ← Cloudflare Worker (AI backend)
│   └── ai-proxy.js
├── data-pipeline/                ← Python pipeline for provider data
├── docs/agents/                  ← Role-specific context for AI assistants
├── serve.bat                     ← Primary local serve script (run from root, port 5500)
├── AWS_DEPLOY.md
├── BLUEHOST_DEPLOY.md
├── STRUCTURE.md
└── ...
```

## Current Deployment Reality (June 2026)

| Component | Hosting | URL / Notes |
|-----------|---------|-------------|
| Marketing Landing + Affiliates | Bluehost **LIVE** | `flopsource.com` — files in `public_html/website_76edd621/` |
| Directory Tool | AWS Amplify **IN PROGRESS** | Target: `directory.flopsource.com` (or Amplify default domain). Deploy the contents of the `website/` folder to an Amplify Hosting app. |
| AI Features | Cloudflare Workers **LIVE** | `flopsourceadvisor.synaptiqs.workers.dev` |

**Why Amplify?** CloudFront required account verification. Amplify provides easy static hosting, automatic HTTPS, and straightforward custom domain setup with external registrars like Bluehost (add the CNAME records Amplify provides).

**Directory launch gate:** `index.html` has `const DIRECTORY_LIVE = false` (implemented in the gate script). While false: "Launching Soon" banner is shown, directory CTAs trigger the email gate (captures leads via Worker) but display a friendly coming-soon toast instead of opening the (not-yet-live) directory. There's also a separate "Join the Waitlist" option in the banner. Flip to `true` and redeploy the landing page once the Amplify app + custom domain (if used) is live. The email gate continues to run for lead capture even after launch. The same localStorage key is shared with the in-app `lead-gate.js`.

## Key Architectural Points

- Root `index.html` is the **main marketing site** and primary user entry point.
- The heavy interactive tool (directory app) is the contents of the `website/` folder (served with its index.html at the root of the hosting).
- Lead generation is a first-class concern: email grabber (via `lead-gate.js`) protects both the AI Consultation button and (after 3 uses) the Comparison tool.
- `affiliates.html` at root is a clean, low-hype reference page showing only programs with real monetary value.
- No `landing/` folder anymore (cleaned up during restructure).
- All AI calls go through the Cloudflare Worker (no user keys). Future rich logging will likely live here too (D1/KV).

## Local Development

Always run `serve.bat` from the **project root** (not inside `website/`). It serves on port 5500 and correctly handles both the landing page and the directory app.

## Next Structural Opportunities

- Consider renaming `website/` → `app/` or `directory/` for cleaner future URLs (`directory.flopsource.com`).
- Add a lightweight admin or stats view for captured leads (future, once logging is implemented).

This structure cleanly separates marketing/lead-gen surface from the professional evaluation tool.
