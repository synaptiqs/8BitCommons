"""
Vultr scraper — public plans API.
Live: fetches GPU plan pricing and availability.
No authentication required.
"""
from datetime import date
from typing import Optional, List, Tuple
from models import Provider, LayerType, CoolingType, Jurisdiction
from .base import BaseScraper

PLANS_URL = "https://api.vultr.com/v2/plans"
GPU_PLANS_URL = "https://api.vultr.com/v2/plans?type=voc"  # voc = Vultr Optimized Cloud (GPU)


class Scraper(BaseScraper):

    KNOWN = {
        "layer_type": LayerType.BARE_METAL,
        "cooling_type": CoolingType.AIR,
        "jurisdiction_zone": Jurisdiction.US_FEDERAL,
        "primary_location": "Global (US, EU, APAC, LATAM)",
        "total_gpus": 12000,
        "network_bandwidth_gbps": 400,
        "interconnect": "100–400GbE",
        "sla_uptime_percent": 99.99,
        "certifications": ["SOC 2", "ISO 27001"],
    }

    def _fetch_live(self) -> Tuple[Optional[float], List[str], str]:
        data = self.fetch_json(GPU_PLANS_URL)
        if not data:
            data = self.fetch_json(PLANS_URL)
        if not data:
            return None, [], "Contact for availability"

        plans = data.get("plans", [])
        gpu_plans = [p for p in plans if p.get("gpu_vram_gb", 0) > 0]

        if not gpu_plans:
            return None, [], "Contact for availability"

        architectures: set = set()
        h100_monthly_per_gpu: List[float] = []

        for plan in gpu_plans:
            gpu_type = plan.get("gpu_type", "")
            monthly = plan.get("monthly_cost", 0) or 0
            gpu_count = plan.get("gpu_count", 1) or 1

            if gpu_type:
                if "H100" in gpu_type:
                    architectures.add("NVIDIA H100")
                    if monthly > 0:
                        h100_monthly_per_gpu.append(monthly / gpu_count)
                elif "H200" in gpu_type:
                    architectures.add("NVIDIA H200")
                elif "A100" in gpu_type:
                    architectures.add("NVIDIA A100")
                elif "L40" in gpu_type:
                    architectures.add("NVIDIA L40S")
                else:
                    architectures.add(gpu_type)

        # Monthly → hourly (720 hrs/month)
        price = min(h100_monthly_per_gpu) / 720 if h100_monthly_per_gpu else None

        locations = set()
        for plan in gpu_plans:
            for loc in plan.get("locations", []):
                locations.add(loc)
        availability = "Immediate" if locations else "Contact for availability"

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
            price_per_gpu_hour_usd=price if price else 2.25,
            certifications=k["certifications"],
            availability_status=availability,
            last_verified=date.today(),
            data_quality="high" if price else "medium",
            source_urls=self.config.get("known_urls", []) + [PLANS_URL],
            website="https://www.vultr.com",
        )
