"""
RunPod scraper — GraphQL pricing API + pricing page.
Live: queries RunPod's public GraphQL endpoint for GPU pricing.
"""
import re
from datetime import date
from typing import Optional, List
from models import Provider, LayerType, CoolingType, Jurisdiction
from .base import BaseScraper

GRAPHQL_URL  = "https://api.runpod.io/graphql"
PRICING_URL  = "https://www.runpod.io/gpu-instance/pricing"

# Public GraphQL query for GPU types — no auth required for community cloud
_GQL_QUERY = """
query {
  gpuTypes {
    id
    displayName
    memoryInGb
    secureCloud
    communityCloud
    lowestPrice(input: { gpuCount: 1, minMemoryInGb: 79, secureCloud: true }) {
      minimumBidPrice
      uninterruptablePrice
    }
  }
}
"""

_PRICE_PAT = re.compile(
    r'H100[^$\n]{0,100}\$\s*(\d+\.?\d*)\s*/\s*hr'
    r'|'
    r'\$\s*(\d+\.?\d*)\s*/\s*hr[^.]{0,80}H100',
    re.IGNORECASE | re.DOTALL,
)


class Scraper(BaseScraper):

    KNOWN = {
        "layer_type": LayerType.GPU_CLOUD,
        "cooling_type": CoolingType.LIQUID,
        "jurisdiction_zone": Jurisdiction.US_FEDERAL,
        "primary_location": "Global (US + EU + APAC)",
        "total_gpus": 32000,
        "network_bandwidth_gbps": 800,
        "interconnect": "200–400GbE",
        "sla_uptime_percent": 99.9,
        "certifications": ["SOC 2"],
    }

    def _from_graphql(self) -> Optional[float]:
        import requests
        try:
            resp = requests.post(
                GRAPHQL_URL,
                json={"query": _GQL_QUERY},
                headers={"Content-Type": "application/json",
                         "User-Agent": "FlopSource/1.0 (+https://flopsource.com/bot)"},
                timeout=12,
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            gpu_types = (data.get("data") or {}).get("gpuTypes", [])
            h100_prices = []
            for g in gpu_types:
                name = (g.get("displayName") or g.get("id") or "").upper()
                if "H100" in name:
                    lp = g.get("lowestPrice") or {}
                    price = lp.get("uninterruptablePrice") or lp.get("minimumBidPrice")
                    if price and 0.5 < float(price) < 20.0:
                        h100_prices.append(float(price))
            return min(h100_prices) if h100_prices else None
        except Exception:
            return None

    def _from_html(self) -> Optional[float]:
        html = self.fetch_html(PRICING_URL)
        if not html:
            return None
        for m in _PRICE_PAT.finditer(html):
            raw = m.group(1) or m.group(2)
            if raw:
                price = float(raw)
                if 0.5 < price < 20.0:
                    return price
        return None

    def run(self) -> Optional[Provider]:
        price = self._from_graphql() or self._from_html()
        k = self.KNOWN
        return Provider(
            id=self.id,
            provider_name=self.name,
            layer_type=k["layer_type"],
            hardware_architectures=["NVIDIA H100", "NVIDIA A100", "AMD MI300X"],
            cooling_type=k["cooling_type"],
            jurisdiction_zone=k["jurisdiction_zone"],
            primary_location=k["primary_location"],
            total_gpus=k["total_gpus"],
            network_bandwidth_gbps=k["network_bandwidth_gbps"],
            interconnect=k["interconnect"],
            sla_uptime_percent=k["sla_uptime_percent"],
            price_per_gpu_hour_usd=price if price else 1.89,
            certifications=k["certifications"],
            availability_status="Immediate",
            last_verified=date.today(),
            data_quality="high" if price else "medium",
            source_urls=self.config.get("known_urls", []) + [PRICING_URL],
            website="https://www.runpod.io",
        )
