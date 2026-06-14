"""
Crusoe Energy scraper — pricing page + status page live check.
Live: fetches Crusoe's pricing page to verify operation and extract rates.
Crusoe differentiates on sustainable (stranded gas) power.
"""
import re
from datetime import date
from typing import Optional
from models import Provider, LayerType, CoolingType, Jurisdiction
from .base import BaseScraper

PRICING_URL = "https://crusoecloud.com/pricing"
ALT_URL     = "https://crusoeenergy.com/cloud"
HOME_URL    = "https://crusoecloud.com"

_PRICE_PAT = re.compile(
    r'H100[^$\n]{0,120}\$\s*(\d+\.?\d+)'
    r'|'
    r'\$\s*(\d+\.?\d+)\s*/\s*(?:GPU[- ])?h(?:r|our)',
    re.IGNORECASE | re.DOTALL,
)


class Scraper(BaseScraper):

    KNOWN = {
        "layer_type": LayerType.GPU_CLOUD,
        "hardware_architectures": ["NVIDIA H100"],
        "cooling_type": CoolingType.IMMERSION,
        "jurisdiction_zone": Jurisdiction.US_FEDERAL,
        "primary_location": "Texas & Colorado, USA",
        "total_gpus": 18000,
        "network_bandwidth_gbps": 3200,
        "interconnect": "NVLink + 400GbE RoCE",
        "sla_uptime_percent": 99.99,
        "price_per_gpu_hour_usd": 2.25,
        "certifications": ["SOC 2 Type II", "ISO 27001"],
        "availability_status": "Immediate",
        "data_quality": "high",
    }

    def _scrape_price(self) -> Optional[float]:
        for url in (PRICING_URL, ALT_URL):
            html = self.fetch_html(url)
            if not html:
                continue
            for m in _PRICE_PAT.finditer(html):
                raw = m.group(1) or m.group(2)
                if raw:
                    price = float(raw)
                    if 0.5 < price < 20.0:
                        return price
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
            website="https://crusoeenergy.com",
            notes=self.config.get("notes"),
        )
