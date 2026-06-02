# How to Add or Update a Provider (FlopSource)

## Quick Update (Recommended for small changes)

1. Edit `config/manual_overrides.json`
2. Add or modify the provider ID with the fields you want to change.
3. Run `run-pipeline.bat`

Example:
```json
{
  "coreweave": {
    "total_gpus": 55000,
    "price_per_gpu_hour_usd": 2.55
  }
}
```

## Adding a New Provider

1. Add the provider to `config/sources.json`:

```json
{
  "id": "new-provider-slug",
  "name": "New Provider Name",
  "layer_type": "GPU Cloud",
  "known_urls": ["https://example.com"],
  "scraper": "manual",
  "enabled": true
}
```

2. Add the data to `providers/manual.py` inside the `known_data` dictionary.

3. Run the pipeline.

## Data Quality Guidelines

- Use `data_quality`: "high", "medium", "low", or "estimated"
- Always set `last_verified` (use today's date when updating)
- Include `source_urls` when possible
- Be honest with `notes` (e.g., "Estimated from public reports")

## After Changes

Always run the pipeline and test the site locally before deploying.