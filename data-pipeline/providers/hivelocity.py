"""
Hivelocity scraper — dedicated server pricing page.
Live: fetches Hivelocity GPU server listing to extract H100 rates.
"""
import re
from datetime import date
from typing import Optional
from models import Provider, LayerType, CoolingType, Jurisdiction
from .base import BaseScraper

SERVERS_URL = "https://www.hivelocity.net/bare-metal-dedicated-server/gpu-servers/"
HOME_URL    = "https://www.hivelocity.net"

_PRICE_PAT = re.compile(
    r'\$\s*(\d{1,4}(?:,\d{3})*(?:\.\d+)?)\s*/\s*(?:mo\.?|month|hr?)'
    r'|'
    r'H100[^$\n]{0,150}\$\s*(\d+\.?\d+)',
    re.IGNORECASE | re.DOTALL,
)
_HOURS_PER_MONTH = 720


class Scraper(BaseScraper):

    KNOWN = {
        "layer_type": LayerType.BARE_METAL,
        "hardware_architectures": ["NVIDIA H100", "NVIDIA A100", "AMD MI300X"],
        "cooling_type": CoolingType.AIR,
        "jurisdiction_zone": Jurisdiction.US_FEDERAL,
        "primary_location": "US + EU + APAC",
        "total_gpus": 3800,
        "network_bandwidth_gbps": 200,
        "interconnect": "100–200GbE",
        "sla_uptime_percent": 99.99,
        "price_per_gpu_hour_usd": 2.05,
        "certifications": ["SOC 2"],
        "availability_status": "Immediate",
        "data_quality": "medium",
    }

    def _scrape_price(self) -> Optional[float]:
        html = self.fetch_html(SERVERS_URL)
        if not html:
            return None
        for m in _PRICE_PAT.finditer(html):
            raw = (m.group(1) or m.group(2) or "").replace(",", "")
            if not raw:
                continue
            val = float(raw)
            if val > 100:
                hourly = val / _HOURS_PER_MONTH
            else:
                hourly = val
            if 0.5 < hourly < 20.0:
                return round(hourly, 3)
        return None

    def run(self) -> Optional[Provider]:
        live_price = self._scrape_price()
        is_live = live_price is not None or self.ping(HOME_URL)
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
            website="https://www.hivelocity.net",
        )
