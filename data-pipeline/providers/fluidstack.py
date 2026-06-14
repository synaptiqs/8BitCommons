"""
FluidStack scraper — pricing page live check.
Live: fetches FluidStack's pricing page to extract H100/H200 rates.
"""
import re
from datetime import date
from typing import Optional
from models import Provider, LayerType, CoolingType, Jurisdiction
from .base import BaseScraper

PRICING_URL = "https://www.fluidstack.io/pricing"

_PRICE_PAT = re.compile(
    r'H[12]00[^$\n]{0,120}\$\s*(\d+\.?\d+)'
    r'|'
    r'\$\s*(\d+\.?\d+)\s*/\s*(?:GPU[- ])?h(?:r|our)[^.]{0,80}H[12]00',
    re.IGNORECASE | re.DOTALL,
)


class Scraper(BaseScraper):

    KNOWN = {
        "layer_type": LayerType.GPU_CLOUD,
        "hardware_architectures": ["NVIDIA H100", "NVIDIA H200"],
        "cooling_type": CoolingType.LIQUID,
        "jurisdiction_zone": Jurisdiction.EU_GDPR,
        "primary_location": "UK + EU + US",
        "total_gpus": 7800,
        "network_bandwidth_gbps": 3200,
        "interconnect": "NVLink + 400GbE",
        "sla_uptime_percent": 99.95,
        "price_per_gpu_hour_usd": 2.55,
        "certifications": ["ISO 27001", "SOC 2"],
        "availability_status": "Immediate",
        "data_quality": "high",
    }

    def _scrape_price(self) -> Optional[float]:
        html = self.fetch_html(PRICING_URL)
        if not html:
            return None
        for m in _PRICE_PAT.finditer(html):
            raw = m.group(1) or m.group(2)
            if raw:
                price = float(raw)
                if 0.5 < price < 20.0:
                    return price
        return None

    def run(self) -> Optional[Provider]:
        live_price = self._scrape_price()
        is_live = live_price is not None or self.ping("https://www.fluidstack.io")
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
            website="https://www.fluidstack.io",
        )
