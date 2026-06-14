"""
Hetzner scraper — Cloud API + pricing page.
Live: checks server_types API for GPU instances, falls back to HTML pricing page.
"""
import re
from datetime import date
from typing import Optional, List, Tuple
from models import Provider, LayerType, CoolingType, Jurisdiction
from .base import BaseScraper

CLOUD_API_URL = "https://api.hetzner.cloud/v1/server_types?page=1&per_page=50"
PRICING_URL   = "https://www.hetzner.com/cloud/gpu-servers"


class Scraper(BaseScraper):

    KNOWN = {
        "layer_type": LayerType.BARE_METAL,
        "cooling_type": CoolingType.AIR,
        "jurisdiction_zone": Jurisdiction.EU_GDPR,
        "primary_location": "Nuremberg, Germany",
        "total_gpus": 2400,
        "network_bandwidth_gbps": 200,
        "interconnect": "100GbE",
        "sla_uptime_percent": 99.95,
        "certifications": ["ISO 27001"],
    }

    def _from_cloud_api(self) -> Tuple[Optional[float], List[str]]:
        data = self.fetch_json(CLOUD_API_URL)
        if not data:
            return None, []

        server_types = data.get("server_types", [])
        gpu_types = [s for s in server_types if "GX" in s.get("name", "").upper()
                     or "GPU" in s.get("description", "").upper()
                     or s.get("gpu", {}).get("model", "")]

        architectures: set = set()
        h100_hourly: List[float] = []

        for st in gpu_types:
            desc = st.get("description", "")
            gpu_info = st.get("gpu", {}) or {}
            gpu_model = gpu_info.get("model", "")
            combined = (desc + " " + gpu_model).upper()

            if "H100" in combined:
                architectures.add("NVIDIA H100")
                gpu_count = gpu_info.get("count", 1) or 1
                prices = st.get("prices", [])
                for p in prices:
                    hourly = p.get("price_hourly", {}).get("gross")
                    if hourly:
                        try:
                            h100_hourly.append(float(hourly) / gpu_count)
                        except (ValueError, TypeError):
                            pass
            elif "H200" in combined:
                architectures.add("NVIDIA H200")

        price = min(h100_hourly) if h100_hourly else None
        return price, sorted(architectures)

    def _from_html(self) -> Optional[float]:
        html = self.fetch_html(PRICING_URL)
        if not html:
            return None
        # Patterns like "€1.55 / hour" or "$1.55/hr"
        patterns = [
            r'[€$]\s*(\d+\.\d+)\s*(?:/|per)\s*(?:h(?:r|our))',
            r'(\d+\.\d+)\s*(?:EUR|USD)\s*(?:/|per)\s*h(?:r|our)',
        ]
        for pat in patterns:
            m = re.search(pat, html, re.IGNORECASE)
            if m:
                price = float(m.group(1))
                if 0.5 < price < 20.0:
                    return price
        return None

    def run(self) -> Optional[Provider]:
        price, architectures = self._from_cloud_api()
        if not price:
            price = self._from_html()

        k = self.KNOWN
        return Provider(
            id=self.id,
            provider_name=self.name,
            layer_type=k["layer_type"],
            hardware_architectures=architectures or ["NVIDIA H100"],
            cooling_type=k["cooling_type"],
            jurisdiction_zone=k["jurisdiction_zone"],
            primary_location=k["primary_location"],
            total_gpus=k["total_gpus"],
            network_bandwidth_gbps=k["network_bandwidth_gbps"],
            interconnect=k["interconnect"],
            sla_uptime_percent=k["sla_uptime_percent"],
            price_per_gpu_hour_usd=price if price else 1.55,
            certifications=k["certifications"],
            availability_status="2–4 weeks",
            last_verified=date.today(),
            data_quality="high" if price else "medium",
            source_urls=self.config.get("known_urls", []) + [CLOUD_API_URL],
            website="https://www.hetzner.com",
        )
