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

    def fetch_html(self, url: str, headers: Optional[Dict[str, str]] = None, timeout: int = 12) -> Optional[str]:
        """Fetch HTML page content. Returns raw HTML string or None."""
        import requests
        headers = headers or {}
        if "User-Agent" not in headers:
            headers["User-Agent"] = (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        try:
            resp = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
            if resp.status_code == 200:
                return resp.text
            print(f"[base] fetch_html HTTP {resp.status_code} for {url}")
        except Exception as e:
            print(f"[base] fetch_html failed for {url}: {e}")
        return None

    def ping(self, url: str, timeout: int = 6) -> bool:
        """HEAD request to confirm a URL is reachable (status < 400)."""
        import requests
        try:
            resp = requests.head(
                url, timeout=timeout, allow_redirects=True,
                headers={"User-Agent": "FlopSource/1.0 (+https://flopsource.com/bot)"},
            )
            return resp.status_code < 400
        except Exception:
            return False

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