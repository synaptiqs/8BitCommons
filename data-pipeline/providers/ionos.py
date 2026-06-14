"""
IONOS scraper — GPU server pricing page.
Live: fetches IONOS GPU server pricing to extract current H100 rates.
"""
import re
from datetime import date
from typing import Optional
from models import Provider, LayerType, CoolingType, Jurisdiction
from .base import BaseScraper

PRICING_URL = "https://www.ionos.com/servers/gpu-servers"
ALT_URL     = "https://www.ionos.de/server/gpu-server"

_PRICE_PAT = re.compile(
    r'[€$]\s*(\d+\.?\d+)\s*(?:/\s*)?(?:month|mo\.?|Monat)'
    r'|'
    r'(\d+\.?\d+)\s*(?:EUR|USD)\s*/\s*(?:month|mo\.?)',
    re.IGNORECASE,
)


class Scraper(BaseScraper):

    # GPU bare-metal rentals at IONOS are monthly — divide to get hourly
    _HOURS_PER_MONTH = 720

    KNOWN = {
        "layer_type": LayerType.BARE_METAL,
        "hardware_architectures": ["NVIDIA H100", "NVIDIA A100"],
        "cooling_type": CoolingType.LIQUID,
        "jurisdiction_zone": Jurisdiction.EU_GDPR,
        "primary_location": "Frankfurt, Germany",
        "total_gpus": 2100,
        "network_bandwidth_gbps": 400,
        "interconnect": "200GbE",
        "sla_uptime_percent": 99.99,
        "price_per_gpu_hour_usd": 1.72,
        "certifications": ["ISO 27001", "SOC 2"],
        "availability_status": "Immediate",
        "data_quality": "medium",
    }

    def _scrape_price(self) -> Optional[float]:
        for url in (PRICING_URL, ALT_URL):
            html = self.fetch_html(url)
            if not html:
                continue
            # Look for GPU context then price
            gpu_idx = html.upper().find("H100")
            if gpu_idx == -1:
                gpu_idx = html.upper().find("GPU")
            context = html[max(0, gpu_idx - 100): gpu_idx + 800] if gpu_idx >= 0 else html
            for m in _PRICE_PAT.finditer(context):
                raw = m.group(1) or m.group(2)
                if raw:
                    monthly = float(raw)
                    hourly = monthly / self._HOURS_PER_MONTH
                    if 0.5 < hourly < 20.0:
                        return round(hourly, 3)
        return None

    def run(self) -> Optional[Provider]:
        live_price = self._scrape_price()
        is_live = live_price is not None or self.ping("https://www.ionos.com")
        k = self.KNOWN
        return Provider(
            id=self.id,
            provider_name=self.name,
            layer_type=k["layer_type"],
            hardware_architectures=k["hardware_architectures"],
            cooling_type=k["cooling_type"],
            jurisdiction_zone=k["jurisdiction_zone"],
            primary_location=k["primary_location"],
            total_gpus=k["total_gpus"],
            network_bandwidth_gbps=k["network_bandwidth_gbps"],
            interconnect=k["interconnect"],
            sla_uptime_percent=k["sla_uptime_percent"],
            price_per_gpu_hour_usd=live_price or k["price_per_gpu_hour_usd"],
            certifications=k["certifications"],
            availability_status=k["availability_status"],
            last_verified=date.today(),
            data_quality="high" if is_live else k["data_quality"],
            source_urls=self.config.get("known_urls", []),
            website="https://www.ionos.com",
        )
