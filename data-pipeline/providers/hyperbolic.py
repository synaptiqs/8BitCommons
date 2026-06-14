"""
Hyperbolic scraper — pricing page live check.
Live: fetches Hyperbolic's GPU marketplace pricing to extract H100 rates.
"""
import re
from datetime import date
from typing import Optional
from models import Provider, LayerType, CoolingType, Jurisdiction
from .base import BaseScraper

PRICING_URL = "https://hyperbolic.xyz/pricing"
HOME_URL    = "https://hyperbolic.xyz"
API_URL     = "https://api.hyperbolic.xyz/v1/marketplace"

_PRICE_PAT = re.compile(
    r'H100[^$\n]{0,120}\$\s*(\d+\.?\d+)'
    r'|'
    r'\$\s*(\d+\.?\d+)\s*/\s*h(?:r|our)',
    re.IGNORECASE | re.DOTALL,
)


class Scraper(BaseScraper):

    KNOWN = {
        "layer_type": LayerType.GPU_CLOUD,
        "hardware_architectures": ["NVIDIA H100", "NVIDIA A100", "NVIDIA L40S"],
        "cooling_type": CoolingType.AIR,
        "jurisdiction_zone": Jurisdiction.US_FEDERAL,
        "primary_location": "US + EU",
        "total_gpus": 8500,
        "network_bandwidth_gbps": 800,
        "interconnect": "200–400GbE",
        "sla_uptime_percent": 99.8,
        "price_per_gpu_hour_usd": 1.75,
        "certifications": [],
        "availability_status": "Immediate",
        "data_quality": "medium",
    }

    def _from_api(self) -> Optional[float]:
        data = self.fetch_json(API_URL)
        if not data:
            return None
        items = data if isinstance(data, list) else data.get("instances", data.get("data", []))
        h100_prices = []
        for item in items:
            gpu = (item.get("gpu_type") or item.get("gpu") or "").upper()
            price = item.get("price_per_hour") or item.get("hourly_price") or 0
            if "H100" in gpu and price and 0.5 < float(price) < 20.0:
                h100_prices.append(float(price))
        return min(h100_prices) if h100_prices else None

    def _from_html(self) -> Optional[float]:
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
        live_price = self._from_api() or self._from_html()
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
            website="https://hyperbolic.xyz",
        )
