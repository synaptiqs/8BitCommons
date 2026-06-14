"""
Cudo Compute scraper — public REST API.
Live: queries Cudo Compute's public machine-types endpoint for GPU pricing.
"""
from datetime import date
from typing import Optional, List, Tuple
from models import Provider, LayerType, CoolingType, Jurisdiction
from .base import BaseScraper

# Cudo Compute public API (no auth required for read-only catalog)
MACHINE_TYPES_URL = "https://rest.compute.cudo.org/v1/virtual-machines/machine-types"
PRICING_URL       = "https://www.cudocompute.com/pricing"


class Scraper(BaseScraper):

    KNOWN = {
        "layer_type": LayerType.GPU_CLOUD,
        "cooling_type": CoolingType.AIR,
        "jurisdiction_zone": Jurisdiction.EU_GDPR,
        "primary_location": "Global (strong EU presence)",
        "total_gpus": 6500,
        "network_bandwidth_gbps": 400,
        "interconnect": "100–400GbE",
        "sla_uptime_percent": 99.9,
        "certifications": ["ISO 27001"],
    }

    def _fetch_live(self) -> Tuple[Optional[float], List[str], str]:
        data = self.fetch_json(MACHINE_TYPES_URL)
        if not data:
            return None, [], "Immediate"

        items = data if isinstance(data, list) else data.get("machine_types", data.get("items", []))
        architectures: set = set()
        h100_prices: List[float] = []
        available_count = 0

        for item in items:
            gpu = (item.get("gpu_model") or item.get("gpu_type") or item.get("name") or "").upper()
            price = item.get("price_per_gpu_hour") or item.get("gpu_price") or 0
            available = item.get("available_count", 0) or item.get("count", 0) or 1

            if "H100" in gpu:
                architectures.add("NVIDIA H100")
                if price and 0.5 < float(price) < 20.0:
                    h100_prices.append(float(price))
                available_count += available
            elif "A100" in gpu:
                architectures.add("NVIDIA A100")
            elif "L40" in gpu:
                architectures.add("NVIDIA L40S")
            elif "H200" in gpu:
                architectures.add("NVIDIA H200")

        price = min(h100_prices) if h100_prices else None
        availability = "Immediate" if available_count > 0 else "Contact for availability"
        return price, sorted(architectures), availability

    def run(self) -> Optional[Provider]:
        price, architectures, availability = self._fetch_live()
        k = self.KNOWN
        return Provider(
            id=self.id,
            provider_name=self.name,
            layer_type=k["layer_type"],
            hardware_architectures=architectures or ["NVIDIA H100", "NVIDIA A100", "NVIDIA L40S"],
            cooling_type=k["cooling_type"],
            jurisdiction_zone=k["jurisdiction_zone"],
            primary_location=k["primary_location"],
            total_gpus=k["total_gpus"],
            network_bandwidth_gbps=k["network_bandwidth_gbps"],
            interconnect=k["interconnect"],
            sla_uptime_percent=k["sla_uptime_percent"],
            price_per_gpu_hour_usd=price if price else 1.85,
            certifications=k["certifications"],
            availability_status=availability,
            last_verified=date.today(),
            data_quality="high" if price else "medium",
            source_urls=self.config.get("known_urls", []) + [MACHINE_TYPES_URL],
            website="https://www.cudocompute.com",
        )
