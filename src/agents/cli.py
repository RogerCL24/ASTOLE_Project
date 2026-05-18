"""Operational CLI for ASTOLE agent stack.

The CLI is intended for local development and demos:
- manage docker-compose lifecycle;
- tail logs with service selection;
- run health checks;
- execute smoke triage calls against `/triage`.
"""

from __future__ import annotations

import argparse
import json
import logging
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict

import httpx

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_API_URL = "http://localhost:8010"

logger = logging.getLogger("astole.cli")


def configure_logging(verbose: bool) -> None:
    """Configure concise CLI logging with optional debug verbosity."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(level=level, format="%(asctime)s | %(levelname)s | %(message)s")


def run_compose(args: list[str]) -> int:
    """Run a docker compose command from project root."""
    cmd = ["docker", "compose"] + args
    logger.debug("Running command: %s", " ".join(cmd))
    completed = subprocess.run(cmd, cwd=PROJECT_ROOT, check=False)
    return completed.returncode


def cmd_up(_: argparse.Namespace) -> int:
    """Build and start the stack in detached mode."""
    return run_compose(["up", "--build", "-d"])


def cmd_down(_: argparse.Namespace) -> int:
    """Stop and remove stack containers."""
    return run_compose(["down"])


def cmd_logs(ns: argparse.Namespace) -> int:
    """Tail docker compose logs for one service or all services."""
    args = ["logs", "-f", "--tail", str(ns.tail)]
    if ns.service:
        args.append(ns.service)
    return run_compose(args)


async def cmd_health(ns: argparse.Namespace) -> int:
    """Run health checks against agents API and external RAG API."""
    api = ns.api_url.rstrip("/")
    targets = [f"{api}/health", "http://localhost:8001/health"]
    async with httpx.AsyncClient(timeout=5) as client:
        for url in targets:
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                logger.info("OK %s -> %s", url, resp.status_code)
            except Exception as exc:
                logger.error("FAIL %s -> %s", url, exc)
                return 1
    return 0


def _load_payload(payload_path: Path) -> Dict[str, Any]:
    data = json.loads(payload_path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Payload must be a JSON object")
    return data


async def cmd_triage(ns: argparse.Namespace) -> int:
    """Submit one alert payload to `/triage` and print formatted result."""
    payload = _load_payload(Path(ns.payload))
    url = f"{ns.api_url.rstrip('/')}/triage"
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(url, json=payload)
        if resp.status_code >= 400:
            logger.error("Triage failed (%s): %s", resp.status_code, resp.text)
            return 1
        result = resp.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


def build_parser() -> argparse.ArgumentParser:
    """Create CLI parser and subcommands."""
    parser = argparse.ArgumentParser(description="ASTOLE operations CLI")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logs")
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help="Base URL for agents API")

    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("up", help="docker compose up --build -d")
    sub.add_parser("down", help="docker compose down")

    logs = sub.add_parser("logs", help="Tail docker compose logs")
    logs.add_argument("--service", default="", help="Optional service name")
    logs.add_argument("--tail", type=int, default=120, help="Tail line count")

    sub.add_parser("health", help="Check agents and RAG health endpoints")

    triage = sub.add_parser("triage", help="POST one payload to /triage")
    triage.add_argument("--payload", required=True, help="Path to JSON payload file")

    return parser


async def dispatch(ns: argparse.Namespace) -> int:
    """Dispatch subcommands to handlers."""
    if ns.command == "up":
        return cmd_up(ns)
    if ns.command == "down":
        return cmd_down(ns)
    if ns.command == "logs":
        return cmd_logs(ns)
    if ns.command == "health":
        return await cmd_health(ns)
    if ns.command == "triage":
        return await cmd_triage(ns)
    logger.error("Unknown command: %s", ns.command)
    return 2


def main() -> int:
    """CLI entrypoint."""
    parser = build_parser()
    ns = parser.parse_args()
    configure_logging(ns.verbose)
    import asyncio

    return asyncio.run(dispatch(ns))


if __name__ == "__main__":
    sys.exit(main())
