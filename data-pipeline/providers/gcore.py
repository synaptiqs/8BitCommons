"""
Gcore scraper — GPU Cloud pricing page.
Live: fetches Gcore's GPU cloud pricing page to extract rates.
"""
import re
from datetime import date
from typing import Optional
from models import Provider, LayerType, CoolingType, Jurisdiction
from .base import BaseScraper

PRICING_URL = "https://gcore.com/cloud/gpu-cloud"
ALT_URL     = "https://gcore.com/pricing/cloud"

_PRICE_PAT = re.compile(
    r'[€$]\s*(\d+\.?\d+)\s*/\s*(?:GPU[- ])?h(?:r|our)'
    r'|'
    r'(\d+\.?\d+)\s*(?:EUR|USD)\s*/\s*h(?:r|our)',
    re.IGNORECASE,
)


class Scraper(BaseScraper):

    KNOWN = {
        "layer_type": LayerType.EDGE,
        "hardware_architectures": ["NVIDIA H100", "NVIDIA L40S"],
        "cooling_type": CoolingType.HYBRID,
        "jurisdiction_zone": Jurisdiction.EU_GDPR,
        "primary_location": "Luxembourg + Singapore + US",
        "total_gpus": 1400,
        "network_bandwidth_gbps": 150,
        "interconnect": "100GbE",
        "sla_uptime_percent": 99.95,
        "price_per_gpu_hour_usd": 3.25,
        "certifications": ["ISO 27001", "SOC 2"],
        "availability_status": "Immediate",
        "data_quality": "medium",
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
        is_live = live_price is not None or self.ping("https://gcore.com")
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
            website="https://gcore.com",
        )
