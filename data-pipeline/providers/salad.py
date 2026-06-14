"""
Salad scraper — public GPU classes API.
Live: fetches current GPU pricing from Salad's public portal API.
Salad is a consumer GPU sharing network — prices are per-GPU market rates.
"""
from datetime import date
from typing import Optional, List, Tuple
from models import Provider, LayerType, CoolingType, Jurisdiction
from .base import BaseScraper

GPUS_URL = "https://portal.salad.com/api/public/gpu-classes"
ALT_URL  = "https://portal.salad.com/api/v1/organizations/salad/gpu-classes"


class Scraper(BaseScraper):

    KNOWN = {
        "layer_type": LayerType.EDGE,
        "cooling_type": CoolingType.AIR,
        "jurisdiction_zone": Jurisdiction.US_FEDERAL,
        "primary_location": "Global (consumer + small DC)",
        "total_gpus": 85000,
        "network_bandwidth_gbps": 100,
        "interconnect": "Consumer broadband + some 10GbE",
        "sla_uptime_percent": 99.0,
        "certifications": [],
    }

    def _fetch_live(self) -> Tuple[Optional[float], List[str], str]:
        data = None
        for url in (GPUS_URL, ALT_URL):
            data = self.fetch_json(url)
            if data:
                break
        if not data:
            return None, [], "Variable (consumer devices)"

        items = data if isinstance(data, list) else data.get("items", data.get("gpu_classes", []))
        architectures: set = set()
        prices: List[float] = []
        rtx4090_prices: List[float] = []

        for item in items:
            name = (item.get("name") or item.get("displayName") or "").upper()
            price = item.get("price", {})
            if isinstance(price, dict):
                hourly = price.get("hourly") or price.get("per_hour") or 0
            else:
                hourly = price or 0

            if "RTX 4090" in name or "4090" in name:
                architectures.add("NVIDIA RTX 4090")
                if hourly and 0.1 < float(hourly) < 5.0:
                    rtx4090_prices.append(float(hourly))
            elif "RTX 3090" in name or "3090" in name:
                architectures.add("NVIDIA RTX 3090")
            elif "L40" in name:
                architectures.add("NVIDIA L40S")
                if hourly and 0.1 < float(hourly) < 20.0:
                    prices.append(float(hourly))

        best_price = min(rtx4090_prices) if rtx4090_prices else (min(prices) if prices else None)
        availability = "Variable (consumer devices)"
        return best_price, sorted(architectures), availability

    def run(self) -> Optional[Provider]:
        price, architectures, availability = self._fetch_live()
        k = self.KNOWN
        return Provider(
            id=self.id,
            provider_name=self.name,
            layer_type=k["layer_type"],
            hardware_architectures=architectures or ["NVIDIA RTX 4090", "NVIDIA RTX 3090", "NVIDIA L40S"],
            cooling_type=k["cooling_type"],
            jurisdiction_zone=k["jurisdiction_zone"],
            primary_location=k["primary_location"],
            total_gpus=k["total_gpus"],
            network_bandwidth_gbps=k["network_bandwidth_gbps"],
            interconnect=k["interconnect"],
            sla_uptime_percent=k["sla_uptime_percent"],
            price_per_gpu_hour_usd=price if price else 0.45,
            certifications=k["certifications"],
            availability_status=availability,
            last_verified=date.today(),
            data_quality="high" if price else "medium",
            source_urls=self.config.get("known_urls", []) + [GPUS_URL],
            website="https://salad.com",
            notes=self.config.get("notes"),
        )
