"""
FlopSource - Data Models
Canonical schema for AI Compute Providers.
"""

from datetime import datetime, date
from enum import Enum
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator


class LayerType(str, Enum):
    GPU_CLOUD = "GPU Cloud"
    BARE_METAL = "Bare-Metal"
    EDGE = "Edge"


class CoolingType(str, Enum):
    LIQUID = "Liquid"
    AIR = "Air"
    IMMERSION = "Immersion"
    HYBRID = "Hybrid"
    UNKNOWN = "Unknown"


class Jurisdiction(str, Enum):
    US_FEDERAL = "US-Federal"
    EU_GDPR = "EU-GDPR"
    APAC_SINGAPORE = "APAC-Singapore"
    APAC_JAPAN = "APAC-Japan"
    UK = "UK"
    CANADA = "Canada"
    AUSTRALIA = "Australia"
    OTHER = "Other / Multi"


class Provider(BaseModel):
    """Canonical provider record for the FlopSource directory."""

    id: str = Field(..., description="Stable unique identifier (slug)")
    provider_name: str

    layer_type: LayerType
    hardware_architectures: List[str] = Field(default_factory=list)
    cooling_type: CoolingType = CoolingType.UNKNOWN
    jurisdiction_zone: Jurisdiction

    primary_location: str
    website: str                           # Official homepage (required - used for "Visit Site" links)
    total_gpus: Optional[int] = None
    network_bandwidth_gbps: Optional[int] = None
    interconnect: Optional[str] = None

    sla_uptime_percent: Optional[float] = Field(default=None, ge=99.0, le=100.0)
    price_per_gpu_hour_usd: Optional[float] = Field(default=None, ge=0)

    certifications: List[str] = Field(default_factory=list)
    availability_status: str = "Contact for availability"

    # Metadata for data quality
    last_verified: Optional[date] = None
    source_urls: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    data_quality: Literal["high", "medium", "low", "estimated"] = "medium"

    @field_validator("id")
    @classmethod
    def validate_id(cls, v: str) -> str:
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError("id must be alphanumeric with dashes/underscores only")
        return v.lower()

    @field_validator("hardware_architectures")
    @classmethod
    def normalize_hardware(cls, v: List[str]) -> List[str]:
        # Normalize common names
        mapping = {
            "h100": "NVIDIA H100",
            "h200": "NVIDIA H200",
            "mi300x": "AMD MI300X",
            "a100": "NVIDIA A100",
            "l40s": "NVIDIA L40S",
            "gaudi": "Intel Gaudi 3",
            "gaudi3": "Intel Gaudi 3",
        }
        normalized = []
        for item in v:
            key = item.lower().replace(" ", "").replace("-", "")
            normalized.append(mapping.get(key, item.strip()))
        return list(dict.fromkeys(normalized))  # dedupe while preserving order

    model_config = {
        "use_enum_values": True,
        "json_encoders": {
            date: lambda d: d.isoformat() if d else None
        }
    }


class DirectoryData(BaseModel):
    """Root container for the published directory."""
    version: int = 1
    generated_at: datetime
    providers: List[Provider]

    model_config = {"json_encoders": {datetime: lambda dt: dt.isoformat()}}


def format_large_number(n: int | float, decimals: int = 1) -> str:
    """
    Format large numbers using K / M / B / T suffixes.
    Matches the JavaScript version used on the frontend.

    Examples:
        950 → "950"
        1200 → "1.2K"
        1002550 → "1M"
        1450000000 → "1.5B"
    """
    if n is None or not isinstance(n, (int, float)):
        return "—"

    abs_n = abs(n)
    sign = "-" if n < 0 else ""

    if abs_n < 1000:
        return f"{sign}{int(round(abs_n))}"

    units = [
        (1_000_000_000_000, "T"),
        (1_000_000_000, "B"),
        (1_000_000, "M"),
        (1_000, "K"),
    ]

    for threshold, suffix in units:
        if abs_n >= threshold:
            value = abs_n / threshold
            if value >= 10:
                formatted = str(int(round(value)))
            else:
                formatted = f"{value:.{decimals}f}".rstrip("0").rstrip(".")
            return f"{sign}{formatted}{suffix}"

    return f"{sign}{int(round(abs_n))}"