"""
Lambda Labs scraper — public instance-types API.
Live: fetches current GPU instance pricing and availability.
No authentication required.
"""
import re
from datetime import date
from typing import Optional, List, Tuple
from models import Provider, LayerType, CoolingType, Jurisdiction
from .base import BaseScraper

INSTANCE_TYPES_URL = "https://cloud.lambdalabs.com/api/v1/instance-types"

GPU_MAP = {
    "h100": "NVIDIA H100",
    "h200": "NVIDIA H200",
    "a100": "NVIDIA A100",
    "a10":  "NVIDIA A10",
    "v100": "NVIDIA V100",
    "a6000": "NVIDIA RTX A6000",
}

def _parse_gpu_count(name: str) -> int:
    m = re.match(r"gpu_(\d+)x_", name)
    return int(m.group(1)) if m else 1

def _parse_gpu_type(name: str, description: str) -> str:
    combined = (name + " " + description).lower()
    for key, label in GPU_MAP.items():
        if key in combined:
            return label
    return "NVIDIA GPU"


class Scraper(BaseScraper):

    KNOWN = {
        "layer_type": LayerType.GPU_CLOUD,
        "cooling_type": CoolingType.LIQUID,
        "jurisdiction_zone": Jurisdiction.US_FEDERAL,
        "primary_location": "California, USA",
        "total_gpus": 9500,
        "network_bandwidth_gbps": 1600,
        "interconnect": "NVLink + 200GbE",
        "sla_uptime_percent": 99.95,
        "certifications": ["SOC 2 Type II"],
    }

    def _fetch_live(self) -> Tuple[Optional[float], List[str], str]:
        data = self.fetch_json(INSTANCE_TYPES_URL)
        if not data or "data" not in data:
            return None, [], "Contact for availability"

        instances = data["data"]
        h100_prices: List[float] = []
        architectures: set = set()
        available_count = 0

        for inst_name, inst_info in instances.items():
            itype = inst_info.get("instance_type", {})
            description = itype.get("description", "") or itype.get("gpu_description", "")
            price_cents = itype.get("price_cents_per_hour") or 0
            gpu_count = _parse_gpu_count(inst_name)
            gpu_label = _parse_gpu_type(inst_name, description)

            architectures.add(gpu_label)

            if price_cents > 0 and gpu_count > 0:
                per_gpu_usd = (price_cents / 100) / gpu_count
                if "h100" in inst_name.lower():
                    h100_prices.append(per_gpu_usd)

            regions = inst_info.get("regions_with_capacity_available", [])
            if regions:
                available_count += 1

        price = min(h100_prices) if h100_prices else None
        arch_list = sorted(architectures)
        availability = "Immediate" if available_count > 0 else "2–6 weeks"
        return price, arch_list, availability

    def run(self) -> Optional[Provider]:
        price, architectures, availability = self._fetch_live()
        k = self.KNOWN
        return Provider(
            id=self.id,
            provider_name=self.name,
            layer_type=k["layer_type"],
            hardware_architectures=architectures or ["NVIDIA H100", "AMD MI300X"],
            cooling_type=k["cooling_type"],
            jurisdiction_zone=k["jurisdiction_zone"],
            primary_location=k["primary_location"],
            total_gpus=k["total_gpus"],
            network_bandwidth_gbps=k["network_bandwidth_gbps"],
            interconnect=k["interconnect"],
            sla_uptime_percent=k["sla_uptime_percent"],
            price_per_gpu_hour_usd=price if price else 2.39,
            certifications=k["certifications"],
            availability_status=availability,
            last_verified=date.today(),
            data_quality="high" if price else "medium",
            source_urls=self.config.get("known_urls", []) + [INSTANCE_TYPES_URL],
            website="https://lambdalabs.com",
        )
