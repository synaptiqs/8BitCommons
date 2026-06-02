"""
Base scraper class for FlopSource providers.
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from models import Provider


class BaseScraper(ABC):
    """Base class for all provider scrapers."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.name = config.get("name", "Unknown Provider")
        self.id = config.get("id", "unknown")

    @abstractmethod
    def run(self) -> Optional[Provider]:
        """Execute the scraper and return a Provider model (or None on failure)."""
        pass

    def enrich_with_known_data(self, provider: Provider) -> Provider:
        """Apply any known static facts from config."""
        # Future: merge with manual_overrides.json
        return provider

    def safe_get(self, data: dict, key: str, default=None):
        """Safe nested get."""
        try:
            return data.get(key, default)
        except Exception:
            return default

    def fetch_json(self, url: str, headers: Optional[Dict[str, str]] = None, timeout: int = 12, retries: int = 2) -> Optional[Dict]:
        """
        Defensive JSON fetch with simple retries and good UA.
        Use this in all live scrapers.
        """
        import time
        import requests

        headers = headers or {}
        if "User-Agent" not in headers:
            headers["User-Agent"] = "FlopSource/1.0 (+https://flopsource.com/bot)"

        last_err = None
        for attempt in range(retries + 1):
            try:
                resp = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
                if resp.status_code == 200:
                    return resp.json()
                last_err = f"HTTP {resp.status_code}"
            except Exception as e:
                last_err = str(e)
            if attempt < retries:
                time.sleep(0.6 * (attempt + 1))
        print(f"[base] fetch_json failed for {url}: {last_err}")
        return None