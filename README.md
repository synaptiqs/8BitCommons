# FlopSource

**AI Compute Infrastructure Directory**

FlopSource is a professional B2B directory for discovering and evaluating AI compute providers — including GPU clouds, bare-metal facilities, and edge nodes.

## What is FlopSource?

- A clean, trustworthy directory for enterprise buyers (CTOs, infrastructure teams, procurement)
- Filter by technical specs (GPU types, cooling, interconnect), compliance (jurisdictions), and availability
- High-quality, curated provider data with clear sourcing and freshness indicators

## Repository Structure

```
FlopSource/
├── index.html            # Marketing landing page (main entry point + lead-gen surface)
├── affiliates.html       # Clean affiliate/referral programs reference page (monetizable only)
├── website/              # The full directory tool (flopsourcedirectory.html + JS modules)
│   ├── js/lead-gate.js   # Email grabber + "after 3 comparisons" gating
│   └── ...
├── data-pipeline/        # Python pipeline (exactly 29 real providers)
├── workers/ai-proxy.js   # Cloudflare Worker powering all AI features
├── docs/agents/          # Context files for different AI assistant roles
├── serve.bat             # Local development server (run from root, port 5500)
├── PHASE1.md
├── ROADMAP.md
└── README.md
```

## Getting Started (Local)

**Recommended**: Double-click `serve.bat` from the **project root**.  
It serves everything correctly on port **5500**:

- `http://localhost:5500/` → Marketing landing page (primary entry)
- `http://localhost:5500/website/flopsourcedirectory.html` → The full directory tool

The landing page drives the current lead-gen focus (email capture after AI button clicks and after 3 comparisons).

## Data Pipeline

```bash
cd data-pipeline

# Easy Windows launcher (recommended)
./run-pipeline.bat

# Or manually
python pipeline.py full
```

See `data-pipeline/README.md` and `data-pipeline/HOW_TO_ADD_PROVIDER.md` for more details.

## Deployment

- Marketing landing page + `affiliates.html` → Bluehost (or any static host) at the root domain.
- Directory tool (`website/`) → AWS S3 + CloudFront (planned long-term).
- AI backend → Already live on Cloudflare Workers (`workers/ai-proxy.js`).

See `AWS_DEPLOY.md`, `BLUEHOST_DEPLOY.md`, and `STRUCTURE.md` for current details.

**Current focus**: Lead generation through the marketing landing page while preserving trust (email grabber on AI Consultation + after 3 comparisons).

## License

MIT License — see [LICENSE](LICENSE) file.

---

*This repository was previously used for the 8BitCommons Bitcoin Ordinals NFT project and has been repurposed for FlopSource.*