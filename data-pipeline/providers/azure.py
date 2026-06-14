"""
Microsoft Azure scraper — Azure Retail Prices public API.
Live: fetches on-demand H100/H200 VM pricing.
No authentication required.
"""
from datetime import date
from typing import Optional, List, Tuple
from models import Provider, LayerType, CoolingType, Jurisdiction
from .base import BaseScraper

# ND H100 v5 series (Standard_ND96isr_H100_v5 = 8x H100 SXM5)
# armSkuName filter targets the exact ND96isr H100 SKU in eastus
PRICES_URL = (
    "https://prices.azure.com/api/retail/prices"
    "?$filter=serviceName eq 'Virtual Machines'"
    " and priceType eq 'Consumption'"
    " and armRegionName eq 'eastus'"
    " and contains(armSkuName,'ND96isr_H100')"
)

# Number of H100 GPUs in the ND H100 v5 instance
ND_H100_GPU_COUNT = 8


class Scraper(BaseScraper):

    KNOWN = {
        "layer_type": LayerType.GPU_CLOUD,
        "cooling_type": CoolingType.LIQUID,
        "jurisdiction_zone": Jurisdiction.US_FEDERAL,
        "primary_location": "Global (East US, West Europe, etc.)",
        "total_gpus": 150000,
        "network_bandwidth_gbps": 3200,
        "interconnect": "InfiniBand + NVLink",
        "sla_uptime_percent": 99.99,
        "certifications": ["SOC 1/2/3", "ISO 27001", "FedRAMP High", "HIPAA"],
    }

    def _fetch_live(self) -> Tuple[Optional[float], List[str], str]:
        data = self.fetch_json(PRICES_URL)
        if not data:
            return None, [], "Contact for availability"

        items = data.get("Items", [])
        if not items:
            return None, [], "Contact for availability"

        architectures: set = set()
        h100_on_demand: List[float] = []

        for item in items:
            sku = item.get("skuName", "")
            product = item.get("productName", "")
            retail = item.get("retailPrice", 0) or 0
            meter = item.get("meterName", "")

            if not retail:
                continue

            combined = (sku + " " + product + " " + meter).upper()

            # Skip spot/dev-test prices for the base price field
            if "SPOT" in combined or "LOW PRIORITY" in combined:
                continue

            if "H200" in combined:
                architectures.add("NVIDIA H200")
            elif "H100" in combined:
                architectures.add("NVIDIA H100")
                # ND96isr_H100_v5 = 8x H100
                gpu_count = ND_H100_GPU_COUNT
                per_gpu = retail / gpu_count
                # Sanity check: Azure H100 on-demand should be $2–$8/GPU/hr
                if 1.0 < per_gpu < 15.0:
                    h100_on_demand.append(per_gpu)
            elif "MI300X" in combined:
                architectures.add("AMD MI300X")

        price = min(h100_on_demand) if h100_on_demand else None
        availability = "Immediate (on-demand); capacity reservations recommended"
        return price, sorted(architectures), availability

    def run(self) -> Optional[Provider]:
        price, architectures, availability = self._fetch_live()
        k = self.KNOWN
        return Provider(
            id=self.id,
            provider_name=self.name,
            layer_type=k["layer_type"],
            hardware_architectures=architectures or ["NVIDIA H100", "NVIDIA H200", "AMD MI300X"],
            cooling_type=k["cooling_type"],
            jurisdiction_zone=k["jurisdiction_zone"],
            primary_location=k["primary_location"],
            total_gpus=k["total_gpus"],
            network_bandwidth_gbps=k["network_bandwidth_gbps"],
            interconnect=k["interconnect"],
            sla_uptime_percent=k["sla_uptime_percent"],
            price_per_gpu_hour_usd=price if price else 3.85,
            certifications=k["certifications"],
            availability_status=availability,
            last_verified=date.today(),
            data_quality="high" if price else "medium",
            source_urls=self.config.get("known_urls", []) + [PRICES_URL],
            website="https://azure.microsoft.com/en-us/products/virtual-machines/nd-h100-v5/",
            notes="ND H100 v5 series. On-demand list pricing; Spot/Reserved pricing substantially lower. Strong Azure ML integration.",
        )
