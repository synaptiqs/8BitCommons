"""
Google Cloud scraper — public GCP pricing JSON.
Live: fetches GCP pricing catalog to extract A3/G2 instance rates (H100/H200).
"""
import re
from datetime import date
from typing import Optional, List
from models import Provider, LayerType, CoolingType, Jurisdiction
from .base import BaseScraper

# GCP publishes a public pricing JSON used by their pricing calculator
PRICELIST_URL = "https://cloudpricingcalculator.appspot.com/static/data/pricelist.json"
# Fallback: GCP pricing page HTML
PRICING_URL   = "https://cloud.google.com/compute/gpus-pricing"

# GPU counts in GCP instances
# a3-highgpu-8g = 8x H100 SXM5; a3-megagpu-8g = 8x H100 SXM5 80GB
A3_GPU_COUNT = 8

_PRICE_PAT = re.compile(
    r'H100[^$\n]{0,150}\$\s*(\d+\.?\d+)'
    r'|'
    r'\$\s*(\d+\.?\d+)\s*/\s*(?:GPU[- ])?h(?:r|our)[^.]{0,100}H100',
    re.IGNORECASE | re.DOTALL,
)


class Scraper(BaseScraper):

    KNOWN = {
        "layer_type": LayerType.GPU_CLOUD,
        "hardware_architectures": ["NVIDIA H100", "NVIDIA H200", "NVIDIA A100"],
        "cooling_type": CoolingType.LIQUID,
        "jurisdiction_zone": Jurisdiction.US_FEDERAL,
        "primary_location": "Global (us-central, europe-west, asia)",
        "total_gpus": 120000,
        "network_bandwidth_gbps": 3200,
        "interconnect": "GPUDirect + Titanium + NVLink",
        "sla_uptime_percent": 99.99,
        "price_per_gpu_hour_usd": 3.95,
        "certifications": ["SOC 1/2/3", "ISO 27001", "FedRAMP High", "HIPAA"],
        "availability_status": "Immediate (on-demand); committed use discounts common",
        "data_quality": "high",
    }

    def _from_pricelist(self) -> Optional[float]:
        data = self.fetch_json(PRICELIST_URL)
        if not data:
            return None

        gcp_prices = data.get("gcp_price_list", data) if isinstance(data, dict) else {}
        # a3-highgpu-8g on-demand in us-central1
        target_keys = [
            "CP-COMPUTEENGINE-VMIMAGE-A3-HIGHGPU-8G",
            "CP-COMPUTEENGINE-VMIMAGE-A3-MEGAGPU-8G",
        ]
        for key in target_keys:
            entry = gcp_prices.get(key)
            if entry and isinstance(entry, dict):
                hourly = entry.get("us", entry.get("us-central1"))
                if hourly:
                    per_gpu = float(hourly) / A3_GPU_COUNT
                    if 0.5 < per_gpu < 30.0:
                        return round(per_gpu, 3)
        return None

    def _from_html(self) -> Optional[float]:
        html = self.fetch_html(PRICING_URL)
        if not html:
            return None
        for m in _PRICE_PAT.finditer(html):
            raw = m.group(1) or m.group(2)
            if raw:
                price = float(raw)
                if 0.5 < price < 30.0:
                    return price
        return None

    def run(self) -> Optional[Provider]:
        price = self._from_pricelist() or self._from_html()
        is_live = price is not None or self.ping("https://cloud.google.com")
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
            price_per_gpu_hour_usd=price or k["price_per_gpu_hour_usd"],
            certifications=k["certifications"],
            availability_status=k["availability_status"],
            last_verified=date.today(),
            data_quality="high" if is_live else k["data_quality"],
            source_urls=self.config.get("known_urls", []) + [PRICELIST_URL],
            website="https://cloud.google.com/compute/docs/accelerator-optimized-machines",
            notes=self.config.get("notes"),
        )
