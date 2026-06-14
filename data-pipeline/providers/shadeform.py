"""
Shadeform scraper — public instances/types API.
Live: fetches GPU marketplace pricing across their multi-cloud layer.
"""
from datetime import date
from typing import Optional, List, Tuple
from models import Provider, LayerType, CoolingType, Jurisdiction
from .base import BaseScraper

TYPES_URL = "https://api.shadeform.ai/v1/instances/types"


class Scraper(BaseScraper):

    KNOWN = {
        "layer_type": LayerType.GPU_CLOUD,
        "cooling_type": CoolingType.LIQUID,
        "jurisdiction_zone": Jurisdiction.US_FEDERAL,
        "primary_location": "Multi-region (orchestration layer)",
        "total_gpus": 15000,
        "network_bandwidth_gbps": 1600,
        "interconnect": "Varies by underlying cloud",
        "sla_uptime_percent": 99.9,
        "certifications": [],
    }

    def _fetch_live(self) -> Tuple[Optional[float], List[str], str]:
        data = self.fetch_json(TYPES_URL)
        if not data:
            return None, [], "Immediate (via orchestration)"

        instances = data if isinstance(data, list) else data.get("instance_types", data.get("data", []))
        if not instances:
            return None, [], "Immediate (via orchestration)"

        architectures: set = set()
        h100_prices: List[float] = []
        available_count = 0

        for inst in instances:
            gpu = inst.get("gpu", "") or inst.get("gpu_type", "") or inst.get("name", "")
            price = inst.get("hourly_price", 0) or inst.get("price_per_gpu_hour", 0) or 0
            num_gpus = inst.get("num_gpus", 1) or 1
            available = inst.get("available", True)

            gpu_upper = str(gpu).upper()
            if "H100" in gpu_upper:
                architectures.add("NVIDIA H100")
                if price > 0:
                    per_gpu = price / num_gpus if price > 10 else price  # might already be per-GPU
                    # Sanity-check: realistic H100 GPU price range $0.50–$20/hr
                    if 0.30 < per_gpu < 20.0:
                        h100_prices.append(per_gpu)
                if available:
                    available_count += 1
            elif "H200" in gpu_upper:
                architectures.add("NVIDIA H200")
            elif "A100" in gpu_upper:
                architectures.add("NVIDIA A100")
            elif "MI300" in gpu_upper:
                architectures.add("AMD MI300X")

        price_result = min(h100_prices) if h100_prices else None
        availability = f"Immediate (via orchestration)" if available_count > 0 else "Contact for availability"
        return price_result, sorted(architectures), availability

    def run(self) -> Optional[Provider]:
        price, architectures, availability = self._fetch_live()
        k = self.KNOWN
        return Provider(
            id=self.id,
            provider_name=self.name,
            layer_type=k["layer_type"],
            hardware_architectures=architectures or ["NVIDIA H100", "NVIDIA A100", "AMD MI300X"],
            cooling_type=k["cooling_type"],
            jurisdiction_zone=k["jurisdiction_zone"],
            primary_location=k["primary_location"],
            total_gpus=k["total_gpus"],
            network_bandwidth_gbps=k["network_bandwidth_gbps"],
            interconnect=k["interconnect"],
            sla_uptime_percent=k["sla_uptime_percent"],
            price_per_gpu_hour_usd=price if price else 2.10,
            certifications=k["certifications"],
            availability_status=availability,
            last_verified=date.today(),
            data_quality="high" if price else "medium",
            source_urls=self.config.get("known_urls", []) + [TYPES_URL],
            website="https://www.shadeform.ai",
            notes=self.config.get("notes"),
        )
