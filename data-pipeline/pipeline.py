#!/usr/bin/env python3
"""
FlopSource - Data Pipeline
Main orchestrator for scraping, cleaning, and building the provider directory.

Usage:
    python -m data_pipeline.pipeline scrape
    python -m data_pipeline.pipeline build
    python -m data_pipeline.pipeline full
"""

import json
import sys
from datetime import datetime, date
from pathlib import Path
from typing import List, Dict, Any, Optional

import typer
from rich.console import Console
from rich.progress import track

from models import Provider, DirectoryData, LayerType, Jurisdiction, CoolingType, format_large_number

console = Console()
ROOT = Path(__file__).parent
CONFIG_PATH = ROOT / "config" / "sources.json"
OUTPUT_PATH = ROOT.parent / "website" / "data" / "data_centers.json"


app = typer.Typer(help="FlopSource AI Compute Directory Data Pipeline")


def load_sources() -> Dict[str, Any]:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_existing_data() -> List[Provider]:
    """Load current production data as fallback."""
    if not OUTPUT_PATH.exists():
        return []
    with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return [Provider(**p) for p in data.get("providers", [])]


def get_scraper(provider_config: dict):
    """Dynamically load scraper module for a provider.
    Falls back to manual research-based data when no dedicated scraper exists.
    """
    scraper_name = provider_config.get("scraper", "manual")
    module_path = ROOT / "providers" / f"{scraper_name}.py"

    if module_path.exists():
        import importlib.util
        spec = importlib.util.spec_from_file_location(f"providers.{scraper_name}", module_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        scraper_class = getattr(module, "Scraper", None)
        if scraper_class:
            return scraper_class(provider_config)

    # Default to manual high-quality data
    from providers.manual import Scraper as ManualScraper
    return ManualScraper(provider_config)


@app.command()
def scrape():
    """Run all enabled scrapers and collect raw data."""
    console.rule("[bold blue]FlopSource - Scraper")
    sources = load_sources()

    results = []
    for provider_cfg in sources["providers"]:
        if not provider_cfg.get("enabled", True):
            continue

        name = provider_cfg["name"]
        console.print(f"[cyan]Loading data for[/cyan] {name}...")

        try:
            scraper = get_scraper(provider_cfg)
            if scraper:
                data = scraper.run()
                if data:
                    results.append(data)
                    q = data.data_quality if hasattr(data, 'data_quality') else 'unknown'
                    console.print(f"  [green]✓[/green] Loaded {name} (quality: {q})")
                else:
                    console.print(f"  [yellow]⚠[/yellow] No data returned for {name}")
            else:
                console.print(f"  [red]✗[/red] No scraper found for {name}")
        except Exception as e:
            console.print(f"  [red]✗[/red] Error loading {name}: {e}")

    # Save raw results for inspection
    raw_path = ROOT / "output" / "raw_scraped.json"
    raw_path.parent.mkdir(exist_ok=True)
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, default=str)

    console.print(f"\n[green]Scraping complete.[/green] Raw data saved to {raw_path}")
    console.print(f"Collected {len(results)} provider records.")


@app.command()
def build():
    """Clean data and build the final directory JSON consumed by the frontend."""
    console.rule("[bold blue]Building Directory Data")

    sources = load_sources()
    providers: List[Provider] = []

    # Load optional manual overrides
    overrides_path = ROOT / "config" / "manual_overrides.json"
    overrides = {}
    if overrides_path.exists():
        with open(overrides_path, "r", encoding="utf-8") as f:
            overrides = json.load(f)
        console.print(f"[dim]Loaded {len(overrides)} manual overrides[/dim]")

    # Collect IDs that should be skipped (set by _skip: true in overrides)
    skip_ids = {pid for pid, data in overrides.items() if data.get("_skip") is True}
    if skip_ids:
        console.print(f"[dim]Skipping {len(skip_ids)} provider(s) via _skip flag: {', '.join(sorted(skip_ids))}[/dim]")

    for provider_cfg in sources["providers"]:
        if not provider_cfg.get("enabled", True):
            continue

        prov_id = provider_cfg.get("id", provider_cfg.get("name", "")).lower().replace(" ", "-")
        if prov_id in skip_ids:
            console.print(f"[dim]  Skipped {provider_cfg['name']} (_skip flag)[/dim]")
            continue

        try:
            scraper = get_scraper(provider_cfg)
            if scraper:
                provider = scraper.run()
                if provider:
                    # Apply overrides if present (skip _skip and _add_providers keys)
                    if provider.id in overrides:
                        override_data = {k: v for k, v in overrides[provider.id].items()
                                         if not k.startswith("_")}
                        for key, value in override_data.items():
                            if hasattr(provider, key):
                                setattr(provider, key, value)
                        if override_data:
                            console.print(f"[blue]→ Applied override for {provider.provider_name}: {list(override_data.keys())}[/blue]")

                    # Enforce required website field
                    if not provider.website or not provider.website.startswith("http"):
                        raise ValueError(f"Missing or invalid 'website' for {provider.provider_name}")

                    providers.append(provider)
                else:
                    console.print(f"[yellow]⚠[/yellow] No data for {provider_cfg['name']}")
        except Exception as e:
            console.print(f"[red]✗[/red] Skipped {provider_cfg['name']}: {e} (continuing...)")

    # Inject manually-specified providers from _add_providers list
    add_providers = overrides.get("_add_providers", [])
    if add_providers:
        console.print(f"[blue]Adding {len(add_providers)} provider(s) from _add_providers[/blue]")
        for raw in add_providers:
            try:
                extra = Provider(**raw)
                if not extra.website or not extra.website.startswith("http"):
                    raise ValueError(f"Missing or invalid 'website' for {extra.provider_name}")
                providers.append(extra)
                console.print(f"  [green]✓[/green] Added {extra.provider_name} (manual override)")
            except Exception as e:
                console.print(f"  [red]✗[/red] Skipped _add_providers entry: {e}")

    if not providers:
        console.print("[yellow]No providers generated. Loading existing production data as fallback.[/yellow]")
        providers = load_existing_data()

    # Final cleaning pass
    for p in providers:
        if not p.last_verified:
            p.last_verified = date.today()
        if not p.data_quality:
            p.data_quality = "medium"

    directory = DirectoryData(
        version=1,
        generated_at=datetime.utcnow(),
        providers=providers
    )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(directory.model_dump(mode="json"), f, indent=2, default=str)

    total_gpus = sum(p.total_gpus or 0 for p in providers)
    formatted_gpus = format_large_number(total_gpus)

    console.print(f"[green]✓[/green] Built directory with {len(providers)} providers")
    console.print(f"[green]✓[/green] Total GPUs indexed: {formatted_gpus} ({total_gpus:,})")
    console.print(f"Output: {OUTPUT_PATH}")


@app.command()
def full():
    """Run scrape → clean → build in one command."""
    scrape()
    build()
    console.print("\n[bold green]Pipeline complete.[/bold green]")


if __name__ == "__main__":
    app()