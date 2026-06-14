"""
Akamai Connected Cloud scraper — Linode/Akamai public instance types API.
Live: fetches GPU instance pricing from api.linode.com.
No authentication required for public plan listings.
"""
from datetime import date
from typing import Optional, List, Tuple
from models import Provider, LayerType, CoolingType, Jurisdiction
from .base import BaseScraper

TYPES_URL = "https://api.linode.com/v4/linode/types"


class Scraper(BaseScraper):

    KNOWN = {
        "layer_type": LayerType.EDGE,
        "cooling_type": CoolingType.AIR,
        "jurisdiction_zone": Jurisdiction.US_FEDERAL,
        "primary_location": "Multiple US + EU metros",
        "total_gpus": 1800,
        "network_bandwidth_gbps": 200,
        "interconnect": "100–200GbE",
        "sla_uptime_percent": 99.99,
        "certifications": ["SOC 2", "ISO 27001", "FedRAMP"],
    }

    def _fetch_live(self) -> Tuple[Optional[float], List[str], str]:
        data = self.fetch_json(TYPES_URL)
        if not data:
            return None, [], "Contact for availability"

        items = data.get("data", [])
        gpu_types = [t for t in items if t.get("gpus", 0) > 0]

        if not gpu_types:
            return None, [], "Contact for availability"

        architectures: set = set()
        h100_hourly: List[float] = []

        for t in gpu_types:
            label = t.get("label", "")
            gpu_label = t.get("gpu_type", "")
            hourly = (t.get("price") or {}).get("hourly", 0) or 0
            gpu_count = t.get("gpus", 1) or 1

            combined = (label + " " + gpu_label).upper()
            if "H100" in combined:
                architectures.add("NVIDIA H100")
                if hourly > 0:
                    h100_hourly.append(hourly / gpu_count)
            elif "H200" in combined:
                architectures.add("NVIDIA H200")
            elif "A100" in combined:
                architectures.add("NVIDIA A100")
            elif "L40" in combined:
                architectures.add("NVIDIA L40S")
            elif gpu_label:
                architectures.add(gpu_label)

        price = min(h100_hourly) if h100_hourly else None
        availability = "Immediate" if gpu_types else "Contact for availability"
        return price, sorted(architectures), availability

    def run(self) -> Optional[Provider]:
        price, architectures, availability = self._fetch_live()
        k = self.KNOWN
        return Provider(
            id=self.id,
            provider_name=self.name,
            layer_type=k["layer_type"],
            hardware_architectures=architectures or ["NVIDIA L40S", "NVIDIA H100"],
            cooling_type=k["cooling_type"],
            jurisdiction_zone=k["jurisdiction_zone"],
            primary_location=k["primary_location"],
            total_gpus=k["total_gpus"],
            network_bandwidth_gbps=k["network_bandwidth_gbps"],
            interconnect=k["interconnect"],
            sla_uptime_percent=k["sla_uptime_percent"],
            price_per_gpu_hour_usd=price if price else 4.10,
            certifications=k["certifications"],
            availability_status=availability,
            last_verified=date.today(),
            data_quality="high" if price else "medium",
            source_urls=self.config.get("known_urls", []) + [TYPES_URL],
            website="https://www.akamai.com/products/connected-cloud",
        )
