"""Optimize IP2Location / IP2Proxy LITE CSVs into Parquet for fast IP enrichment.

Expected inputs (no headers):
- IP2LOCATION-LITE-ASN.CSV: col0 ip_from, col1 ip_to, col3 asn, col4 asn_name
    Example:
        16778752,"16779007","1.0.6.0/24","38803","GTelecom Pty Ltd"
- IP2PROXY-LITE-PX2.CSV: col0 ip_from, col1 ip_to, col2 proxy_type, col3 country_code, col4 country_name
    Example:
        16782178,"16782178","PUB","JP","Japan"

Outputs:
- Writes Parquet files into an output directory (default: data/ip_intel/)

Notes:
- Keeps datasets separate by default (recommended for size/perf).
- Ensures ip_from/ip_to are int64 and sorts by ip_from.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


def _read_dbasn(csv_path: Path) -> pd.DataFrame:
    # Read as strings first to tolerate quoted numerics and placeholder values like '-'.
    df = pd.read_csv(
        csv_path,
        header=None,
        usecols=[0, 1, 3, 4],
        names=["ip_from", "ip_to", "asn", "asn_name"],
        dtype={0: "string", 1: "string", 3: "string", 4: "string"},
        low_memory=False,
    )

    df["ip_from"] = pd.to_numeric(df["ip_from"], errors="coerce").astype("Int64")
    df["ip_to"] = pd.to_numeric(df["ip_to"], errors="coerce").astype("Int64")
    df["asn"] = df["asn"].fillna("").astype("string").str.strip()
    df["asn_name"] = df["asn_name"].fillna("").astype("string").str.strip()

    df = df.dropna(subset=["ip_from", "ip_to"]).copy()
    df["ip_from"] = df["ip_from"].astype("int64")
    df["ip_to"] = df["ip_to"].astype("int64")
    df = df.sort_values(["ip_from", "ip_to"], kind="mergesort").reset_index(drop=True)
    return df


def _read_px2(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(
        csv_path,
        header=None,
        usecols=[0, 1, 2, 3, 4],
        names=["ip_from", "ip_to", "proxy_type", "country_code", "country_name"],
        dtype={0: "string", 1: "string", 2: "string", 3: "string", 4: "string"},
        low_memory=False,
    )

    df["ip_from"] = pd.to_numeric(df["ip_from"], errors="coerce").astype("Int64")
    df["ip_to"] = pd.to_numeric(df["ip_to"], errors="coerce").astype("Int64")
    df["proxy_type"] = df["proxy_type"].fillna("").astype("string").str.strip()
    df["country_code"] = df["country_code"].fillna("").astype("string").str.strip().str.upper()
    df["country_name"] = df["country_name"].fillna("").astype("string").str.strip()

    df = df.dropna(subset=["ip_from", "ip_to"]).copy()
    df["ip_from"] = df["ip_from"].astype("int64")
    df["ip_to"] = df["ip_to"].astype("int64")
    df = df.sort_values(["ip_from", "ip_to"], kind="mergesort").reset_index(drop=True)
    return df


def _read_db1(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(
        csv_path,
        header=None,
        usecols=[0, 1, 2, 3],
        names=["ip_from", "ip_to", "country_code", "country_name"],
        dtype={0: "string", 1: "string", 2: "string", 3: "string"},
        low_memory=False,
    )

    df["ip_from"] = pd.to_numeric(df["ip_from"], errors="coerce").astype("Int64")
    df["ip_to"] = pd.to_numeric(df["ip_to"], errors="coerce").astype("Int64")
    df["country_code"] = df["country_code"].fillna("").astype("string").str.strip().str.upper()
    df["country_name"] = df["country_name"].fillna("").astype("string").str.strip()

    df = df.dropna(subset=["ip_from", "ip_to"]).copy()
    df["ip_from"] = df["ip_from"].astype("int64")
    df["ip_to"] = df["ip_to"].astype("int64")
    df = df.sort_values(["ip_from", "ip_to"], kind="mergesort").reset_index(drop=True)
    return df


def _write_parquet(df: pd.DataFrame, out_path: Path, compression: str) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out_path, index=False, engine="pyarrow", compression=compression)


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert IP2Location/IP2Proxy LITE CSVs (no headers) into Parquet.")
    default_raw_dir = Path("src") / "ingestion" / "raw_data"
    parser.add_argument(
        "--dbasn",
        type=Path,
        default=default_raw_dir / "IP2LOCATION-LITE-ASN.CSV",
        help="Path to IP2LOCATION-LITE-ASN.CSV (default: src/ingestion/raw_data/IP2LOCATION-LITE-ASN.CSV)",
    )
    parser.add_argument(
        "--px2",
        type=Path,
        default=default_raw_dir / "IP2PROXY-LITE-PX2.CSV",
        help="Path to IP2PROXY-LITE-PX2.CSV (default: src/ingestion/raw_data/IP2PROXY-LITE-PX2.CSV)",
    )
    parser.add_argument(
        "--db1",
        type=Path,
        default=default_raw_dir / "IP2LOCATION-LITE-DB1.CSV",
        help="Path to IP2LOCATION-LITE-DB1.CSV (default: src/ingestion/raw_data/IP2LOCATION-LITE-DB1.CSV)",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("data") / "ip_intel",
        help="Output directory for Parquet files (default: data/ip_intel)",
    )
    parser.add_argument(
        "--compression",
        choices=["snappy", "zstd", "gzip"],
        default="snappy",
        help="Parquet compression codec (default: snappy)",
    )
    parser.add_argument(
        "--merge",
        action="store_true",
        help="Also write an outer-joined parquet (heavier; not recommended unless you need a single table).",
    )

    args = parser.parse_args()

    dbasn = _read_dbasn(args.dbasn)
    px2 = _read_px2(args.px2)

    _write_parquet(dbasn, args.out_dir / "dbasn.parquet", args.compression)
    _write_parquet(px2, args.out_dir / "px2.parquet", args.compression)

    db1 = None
    if args.db1.exists():
        db1 = _read_db1(args.db1)
        _write_parquet(db1, args.out_dir / "db1.parquet", args.compression)

    if args.merge:
        merged = pd.merge(
            dbasn,
            px2,
            how="outer",
            on=["ip_from", "ip_to"],
            suffixes=("_asn", "_px"),
            copy=False,
        )
        merged = merged.sort_values(["ip_from", "ip_to"], kind="mergesort").reset_index(drop=True)
        _write_parquet(merged, args.out_dir / "ip_intel_merged.parquet", args.compression)

    print("✅ Parquet generado en:", args.out_dir.resolve())
    print("- dbasn.parquet")
    print("- px2.parquet")
    if db1 is not None:
        print("- db1.parquet")
    if args.merge:
        print("- ip_intel_merged.parquet")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
