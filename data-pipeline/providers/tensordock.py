"""
TensorDock scraper — marketplace hostnodes API.
Live: queries TensorDock's public marketplace API for GPU offers and pricing.
"""
from datetime import date
from typing import Optional, List, Tuple
from models import Provider, LayerType, CoolingType, Jurisdiction
from .base import BaseScraper

HOSTNODES_URL = "https://marketplace.tensordock.com/api/v0/client/deploy/hostnodes"


class Scraper(BaseScraper):

    KNOWN = {
        "layer_type": LayerType.GPU_CLOUD,
        "cooling_type": CoolingType.AIR,
        "jurisdiction_zone": Jurisdiction.US_FEDERAL,
        "primary_location": "US + EU + Asia",
        "total_gpus": 4200,
        "network_bandwidth_gbps": 400,
        "interconnect": "200–400GbE",
        "sla_uptime_percent": 99.9,
        "certifications": ["SOC 2"],
    }

    def _fetch_live(self) -> Tuple[Optional[float], List[str], str]:
        data = self.fetch_json(HOSTNODES_URL)
        if not data:
            return None, [], "Immediate"

        hostnodes = data.get("hostnodes", data if isinstance(data, dict) else {})
        architectures: set = set()
        h100_prices: List[float] = []
        available_nodes = 0

        for node_id, node in (hostnodes.items() if isinstance(hostnodes, dict) else []):
            gpus = node.get("gpu", {}) or {}
            for gpu_name, gpu_info in (gpus.items() if isinstance(gpus, dict) else []):
                gpu_upper = gpu_name.upper()
                price = gpu_info.get("price", {}).get("per_gpu_hour", 0) if isinstance(gpu_info, dict) else 0

                if "H100" in gpu_upper:
                    architectures.add("NVIDIA H100")
                    available = gpu_info.get("amount", 0) if isinstance(gpu_info, dict) else 0
                    if available > 0 and price and 0.5 < float(price) < 20.0:
                        h100_prices.append(float(price))
                        available_nodes += available
                elif "A100" in gpu_upper:
                    architectures.add("NVIDIA A100")
                elif "L40" in gpu_upper:
                    architectures.add("NVIDIA L40S")
                elif "H200" in gpu_upper:
                    architectures.add("NVIDIA H200")

        price = min(h100_prices) if h100_prices else None
        availability = f"Immediate ({available_nodes} H100 GPUs available)" if available_nodes > 0 else "Immediate"
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
            price_per_gpu_hour_usd=price if price else 1.95,
            certifications=k["certifications"],
            availability_status=availability,
            last_verified=date.today(),
            data_quality="high" if price else "medium",
            source_urls=self.config.get("known_urls", []) + [HOSTNODES_URL],
            website="https://tensordock.com",
            notes=self.config.get("notes"),
        )
