# FlopSource Data Pipeline

> **Want the easy way?**  
> Just double-click `run-pipeline.bat` (or `run-pipeline.ps1`) inside this folder.  
> The scripts now handle the common Microsoft Store Python alias problem automatically.

This directory contains the data collection, cleaning, and directory generation system for the AI Compute Infrastructure Directory.

## Goals

- Maintain a high-quality, structured dataset of GPU cloud, bare-metal, and edge providers.
- Make data collection as automated as possible while acknowledging reality (most serious providers do not publish real-time inventory).
- Produce the `website/data/data_centers.json` file consumed by the frontend.

## Architecture

```
data-pipeline/
├── pipeline.py              # Main CLI orchestrator
├── models.py                # Pydantic schema (single source of truth)
├── requirements.txt
├── config/
│   └── sources.json         # List of providers + metadata
├── providers/
│   ├── base.py              # Abstract base scraper
│   ├── manual.py            # High-quality research-backed data
│   ├── vast.py              # Example real scraper (marketplace)
│   └── coreweave.py         # (to be implemented)
├── output/                  # Intermediate artifacts
└── README.md
```

## Usage (Recommended for Desktop)

### Windows (Easiest Method)

1. Go to the `data-pipeline` folder in File Explorer.
2. Double-click one of these files:

   - **`run-pipeline.bat`** ← Best for most people (Command Prompt)
   - **`run-pipeline.ps1`** ← PowerShell version

The script will automatically:
- Create a Python virtual environment (if needed)
- Install all dependencies
- Run the full scrape + build pipeline

### Manual Method (Advanced)

```bash
cd data-pipeline

# Create and activate virtual environment (first time only)
python -m venv .venv

# Windows
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the full pipeline
python pipeline.py full

# Or run steps individually
python pipeline.py scrape
python pipeline.py build
```

## Troubleshooting

### "Python was not found" or Microsoft Store error

This is the **#1 issue** on Windows.

**Step 1: Run the diagnostic**

Double-click `check-python.bat` (or `check-python.ps1`) in this folder.

It will tell you exactly what's wrong and give you the best command to use.

**Step 2: Fix the Microsoft Store alias (if needed)**

1. Press the Windows key and type:  
   `Manage app execution aliases`
2. Open the top result.
3. Turn **OFF** the toggles for:
   - `python.exe`
   - `python3.exe`
4. Close the window and run the diagnostic again.

Then install Python from the real source if you haven't already:  
https://www.python.org/downloads/ (check "Add Python to PATH").

---

## Manual Overrides

You can quickly tweak provider data without editing Python by using:

`config/manual_overrides.json`

Example:
```json
{
  "coreweave": {
    "total_gpus": 52000,
    "notes": "Updated manually on 2026-05-29"
  }
}
```

The pipeline will automatically merge these overrides when building.

## Data Quality Philosophy

We use four quality tiers:

| Tier     | Meaning                                      | Example Sources                  |
|----------|----------------------------------------------|----------------------------------|
| `high`   | Recently verified from official sources      | Provider docs, earnings calls    |
| `medium` | Good public information + estimates          | Websites, status pages           |
| `low`    | Aggregated / third-party reports             | News, analyst reports            |
| `estimated` | Rough order-of-magnitude                   | Industry knowledge               |

Every record must have a `last_verified` date and `data_quality` rating.

## Adding a New Provider

1. Add entry to `config/sources.json`
2. Create `providers/<slug>.py` implementing `BaseScraper`
3. (Recommended) Also add a manual override entry in `providers/manual.py` for reliability

## Important Reality Check

Most enterprise GPU cloud providers (CoreWeave, Crusoe, Lambda, etc.) do **not** publish accurate real-time GPU counts or pricing. 

The most reliable long-term strategy is usually:
- Strong manual/research data (updated quarterly)
- Automated scraping only for marketplaces (Vast.ai, RunPod, etc.)
- Clear "last verified" dates in the UI

## Output

The pipeline writes to:

```
website/data/data_centers.json
```

This file is what the frontend loads.
