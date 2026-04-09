from __future__ import annotations

import os
from dataclasses import dataclass
from ipaddress import IPv4Address
from pathlib import Path
from threading import Lock
from typing import Optional
from bisect import bisect_right

import pandas as pd


@dataclass(frozen=True)
class _RangeIndex:
    ip_from: list[int]
    ip_to: list[int]
    df: pd.DataFrame


def _ip_to_int(ip_str: str) -> int:
    return int(IPv4Address(str(ip_str).strip()))


def _safe_lower_country(value: object) -> str:
    raw = str(value or "").strip()
    if not raw or raw == "-":
        return "zz"
    return raw.lower()


def _clean_placeholder(value: object) -> str:
    raw = str(value or "").strip()
    return "" if raw == "-" else raw


def _infer_connection_type(isp: str, proxy_type: str) -> str:
    isp_norm = str(isp or "").lower()
    proxy_norm = str(proxy_type or "").upper()

    cloud_markers = (
        "amazon",
        "aws",
        "google",
        "microsoft",
        "azure",
        "digitalocean",
        "ovh",
        "hetzner",
        "cloudflare",
        "fastly",
        "oracle",
        "linode",
    )
    telco_markers = (
        "telefonica",
        "vodafone",
        "orange",
        "verizon",
        "comcast",
        "att",
        "t-mobile",
        "deutsche telekom",
        "telia",
    )

    # IP2Proxy proxy_type: '-' means no proxy.
    if proxy_norm and proxy_norm != "-":
        if proxy_norm == "DCH":
            return "Data Center"
        # VPN / TOR / PUB / WEB / SES / etc.
        return "Unknown"

    if any(marker in isp_norm for marker in cloud_markers):
        return "Data Center"

    if any(marker in isp_norm for marker in telco_markers):
        return "Residential"

    if not isp_norm or isp_norm == "unknown":
        return "Unknown"

    return "Business"


def _infer_usage_type(*, conn_type: str, isp: str, proxy_type: str, is_privacy_proxy: bool) -> str:
    if is_privacy_proxy:
        return "Proxy / VPN"

    if conn_type == "Data Center":
        return "Cloud / Datacenter"

    isp_norm = str(isp or "").lower()
    mobile_markers = (
        "mobile",
        "wireless",
        "cellular",
        "lte",
        "5g",
    )
    if any(marker in isp_norm for marker in mobile_markers):
        return "Mobile"

    if conn_type == "Residential":
        return "Residential"

    if conn_type == "Business":
        return "Business"

    return "Unknown"


class IPIntelService:
    """Ultra-fast IP enrichment using IP2Location ranges stored as Parquet.

    Loads Parquet into memory on first instantiation and uses binary search over
    sorted ip_from arrays to locate the matching range.

    Default data dir: data/ip_intel (override with env var IP_INTEL_DATA_DIR)
    Expected files:
      - dbasn.parquet
            - db1.parquet
      - px2.parquet
    """

    _instance: Optional["IPIntelService"] = None
    _lock = Lock()

    @classmethod
    def get_instance(cls, data_dir: Optional[Path] = None) -> "IPIntelService":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls(data_dir=data_dir)
            return cls._instance

    def __init__(self, data_dir: Optional[Path] = None):
        if data_dir is None:
            data_dir = Path(os.getenv("IP_INTEL_DATA_DIR", Path("data") / "ip_intel"))

        self.data_dir = Path(data_dir)
        self._dbasn = self._load_ranges(
            self.data_dir / "dbasn.parquet",
            required_cols=["ip_from", "ip_to", "asn", "asn_name"],
        )
        self._db1 = self._load_ranges(
            self.data_dir / "db1.parquet",
            required_cols=["ip_from", "ip_to", "country_code", "country_name"],
        )
        self._px2 = self._load_ranges(
            self.data_dir / "px2.parquet",
            required_cols=["ip_from", "ip_to", "proxy_type", "country_code", "country_name"],
        )

    def _load_ranges(self, parquet_path: Path, *, required_cols: list[str]) -> Optional[_RangeIndex]:
        if not parquet_path.exists():
            return None

        try:
            df = pd.read_parquet(parquet_path, engine="pyarrow")
        except Exception:
            # Missing pyarrow / corrupted parquet / etc. Fail open.
            return None
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise ValueError(f"Missing columns in {parquet_path}: {missing}")

        df = df[required_cols].copy()
        df["ip_from"] = pd.to_numeric(df["ip_from"], errors="coerce").astype("Int64")
        df["ip_to"] = pd.to_numeric(df["ip_to"], errors="coerce").astype("Int64")
        df = df.dropna(subset=["ip_from", "ip_to"]).copy()
        df["ip_from"] = df["ip_from"].astype("int64")
        df["ip_to"] = df["ip_to"].astype("int64")

        # Ensure sorted by ip_from for binary search.
        if not df["ip_from"].is_monotonic_increasing:
            df = df.sort_values(["ip_from", "ip_to"], kind="mergesort").reset_index(drop=True)

        return _RangeIndex(ip_from=df["ip_from"].astype("int64").tolist(), ip_to=df["ip_to"].astype("int64").tolist(), df=df)

    def _lookup(self, index: Optional[_RangeIndex], ip_val: int) -> Optional[pd.Series]:
        if index is None:
            return None

        pos = int(bisect_right(index.ip_from, ip_val) - 1)
        if pos < 0 or pos >= len(index.ip_from):
            return None

        if ip_val <= int(index.ip_to[pos]):
            return index.df.iloc[pos]

        return None

    def get_info(self, ip_str: str) -> dict:
        """Return enrichment info for an IPv4 address.

        Returns a dict shaped as:
        {
          "country": "es",
          "isp": "Telefónica ...",
          "type": "Residential",
          "is_proxy": False
        }
        """

        try:
            ip_val = _ip_to_int(ip_str)
        except Exception:
            return {
                "country": "zz",
                "country_name": "Unknown",
                "isp": "Unknown",
                "type": "Unknown",
                "usage_type": "Unknown",
                "is_proxy": False,
            }

        asn_row = self._lookup(self._dbasn, ip_val)
        db1_row = self._lookup(self._db1, ip_val)
        px_row = self._lookup(self._px2, ip_val)

        if asn_row is not None:
            asn_name = _clean_placeholder(asn_row.get("asn_name", ""))
            asn = _clean_placeholder(asn_row.get("asn", "")).lstrip("AS").lstrip("as")
            if asn and asn not in {"-", "0"}:
                isp = f"AS{asn} {asn_name}".strip() if asn_name else f"AS{asn}"
            else:
                isp = asn_name or "Unknown"
        else:
            isp = "Unknown"
        base_country = _safe_lower_country(db1_row["country_code"] if db1_row is not None else "zz")
        base_country_name = _clean_placeholder(db1_row.get("country_name", "")) if db1_row is not None else ""

        proxy_country = _safe_lower_country(px_row["country_code"] if px_row is not None else "zz")
        proxy_country_name = _clean_placeholder(px_row.get("country_name", "")) if px_row is not None else ""

        country = proxy_country if proxy_country != "zz" else base_country
        country_name = proxy_country_name if proxy_country != "zz" and proxy_country_name else base_country_name
        if not country_name:
            country_name = "Unknown"

        proxy_type = str(px_row["proxy_type"]).strip() if px_row is not None else ""

        proxy_norm = proxy_type.strip().upper()
        # PX2 codes: treat these as privacy nodes.
        privacy_proxy_types = {"PUB", "VPN", "TOR", "WEB"}
        is_privacy_proxy = proxy_norm in privacy_proxy_types
        is_proxy = is_privacy_proxy
        conn_type = _infer_connection_type(isp=isp, proxy_type=proxy_type)
        usage_type = _infer_usage_type(conn_type=conn_type, isp=isp, proxy_type=proxy_type, is_privacy_proxy=is_privacy_proxy)

        return {
            "country": country,
            "country_name": country_name,
            "isp": isp,
            "type": conn_type,
            "usage_type": usage_type,
            "is_proxy": is_proxy,
        }
