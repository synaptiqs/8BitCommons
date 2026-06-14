"""
Scaleway scraper — public Instance API + pricing page.
Live: queries the Scaleway instance server-types endpoint for GPU offers.
"""
import re
from datetime import date
from typing import Optional, List, Tuple
from models import Provider, LayerType, CoolingType, Jurisdiction
from .base import BaseScraper

# Scaleway GPU instances are in fr-par-2 (Paris) zone
SERVERS_URL = "https://api.scaleway.com/instance/v1/zones/fr-par-2/products/servers"
PRICING_URL = "https://www.scaleway.com/en/pricing/gpu/"


class Scraper(BaseScraper):

    KNOWN = {
        "layer_type": LayerType.BARE_METAL,
        "cooling_type": CoolingType.LIQUID,
        "jurisdiction_zone": Jurisdiction.EU_GDPR,
        "primary_location": "Paris, France",
        "total_gpus": 1650,
        "network_bandwidth_gbps": 400,
        "interconnect": "200GbE",
        "sla_uptime_percent": 99.99,
        "certifications": ["ISO 27001"],
    }

    def _from_api(self) -> Tuple[Optional[float], List[str]]:
        data = self.fetch_json(SERVERS_URL)
        if not data:
            return None, []

        servers = data.get("servers", {})
        if isinstance(servers, list):
            server_list = servers
        else:
            server_list = list(servers.values())

        architectures: set = set()
        h100_prices: List[float] = []

        for s in server_list:
            name = s.get("name", "")
            gpus = s.get("gpus", []) or []
            hourly_price = None

            per_hour = s.get("hourly_price")
            if per_hour and isinstance(per_hour, (int, float)):
                hourly_price = per_hour / 100  # prices in centimes

            for gpu in gpus:
                gpu_name = str(gpu).upper() if isinstance(gpu, str) else ""
                if "H100" in name.upper() or "H100" in gpu_name:
                    architectures.add("NVIDIA H100")
                    if hourly_price and hourly_price > 0:
                        h100_prices.append(hourly_price)
                elif "H100" in name.upper():
                    architectures.add("NVIDIA H100")

        price = min(h100_prices) if h100_prices else None
        return price, sorted(architectures)

    def _from_html(self) -> Optional[float]:
        html = self.fetch_html(PRICING_URL)
        if not html:
            return None
        patterns = [
            r'H100[^€$\n]{0,80}[€$]\s*(\d+\.?\d*)',
            r'[€$]\s*(\d+\.?\d*)\s*(?:/\s*)?h(?:r|our)[^.]{0,80}H100',
            r'(\d+\.?\d*)\s*€\s*/\s*h(?:r|our)',
        ]
        for pat in patterns:
            m = re.search(pat, html, re.IGNORECASE | re.DOTALL)
            if m:
                price = float(m.group(1))
                if 0.5 < price < 20.0:
                    return price
        return None

    def run(self) -> Optional[Provider]:
        price, architectures = self._from_api()
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
            price_per_gpu_hour_usd=price if price else 1.68,
            certifications=k["certifications"],
            availability_status="2–3 weeks",
            last_verified=date.today(),
            data_quality="high" if price else "medium",
            source_urls=self.config.get("known_urls", []) + [SERVERS_URL],
            website="https://www.scaleway.com",
        )
