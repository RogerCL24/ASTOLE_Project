"""ASTOLE — MCP Server: exposes the triage pipeline as an MCP Tool.

Run with:
    python -m src.agents.mcp_server.server
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from src.agents.core.config import setup_litellm
from src.agents.graph.workflow import triage_graph

logger = logging.getLogger(__name__)

server = Server("astole-triage")

_TRIAGE_INPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "alert_id": {"type": "string", "description": "Unique alert ID (e.g. AST-2026-001)"},
        "timestamp": {"type": "string", "description": "ISO 8601 detection timestamp"},
        "window_id": {"type": "string", "description": "60s window ID for correlation"},
        "gnn_metadata": {
            "type": "object",
            "properties": {
                "binary_attack": {"type": "integer", "enum": [0, 1], "description": "0=Benign, 1=Attack"},
                "label_binary": {"type": ["string", "integer"], "description": "Legacy alias"},
                "label_multiclase": {
                    "type": "string",
                    "enum": [
                        "Benign", "DoS", "Fuzzers", "Exploits", "Backdoor",
                        "Reconnaissance", "Analysis", "Generic",
                        "Shellcode", "Worms",
                    ],
                    "description": "Attack category from GNN",
                },
                "label_multiclass": {"type": "string", "description": "Legacy alias"},
                "confidence_score": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                    "description": "GNN model confidence",
                },
                "model_version": {"type": "string"},
            },
            "required": ["confidence_score"],
        },
        "network_data": {
            "type": "object",
            "properties": {
                "src_ip": {"type": "string"},
                "dst_ip": {"type": "string"},
                "src_port": {"type": "integer", "minimum": 0, "maximum": 65535},
                "dst_port": {"type": "integer", "minimum": 0, "maximum": 65535},
                "protocol": {"type": "integer", "description": "IP protocol (6=TCP, 17=UDP, 1=ICMP)"},
                "duration_ms": {"type": "number"},
                "in_bytes": {"type": "integer"},
                "out_bytes": {"type": "integer"},
                "in_pkts": {"type": "integer"},
                "out_pkts": {"type": "integer"},
                "tcp_flags": {"type": "integer"},
            },
            "required": ["src_ip", "dst_ip", "src_port", "dst_port", "protocol"],
        },
        "top_features": {"type": "object", "description": "Key GNN features (free-form)"},
        "window_stats": {
            "type": "object",
            "properties": {
                "total_flows": {"type": "integer"},
                "attack_flows": {"type": "integer"},
                "attack_ratio": {"type": "number"},
                "unique_src_ips": {"type": "integer"},
                "unique_dst_ips": {"type": "integer"},
            },
        },
    },
    "required": ["alert_id", "timestamp", "gnn_metadata", "network_data"],
}


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="triage_alert",
            description=(
                "Analyze a network security alert through the ASTOLE multi-agent "
                "triage pipeline. Takes GNN classification metadata and NetFlow data, "
                "routes to a specialized SOC skill, and returns a structured triage "
                "report with severity, narrative, IOCs, and investigation hints."
            ),
            inputSchema=_TRIAGE_INPUT_SCHEMA,
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    if name != "triage_alert":
        return [TextContent(type="text", text=json.dumps({"error": f"Unknown tool: {name}"}))]

    initial_state = {
        "input": arguments,
        "skill_activated": "",
        "confidence_tier": "standard",
        "rag_context": "",
        "rag_snippets_count": 0,
        "assessment": {},
        "tokens_used": {"router": 0, "skill": 0, "summarizer": 0, "total": 0},
        "cost_usd": 0.0,
        "models_used": [],
        "cache_hit": False,
        "errors": [],
    }

    try:
        result = await triage_graph.ainvoke(initial_state)
        output = result.get("triage_output", {})
        return [TextContent(type="text", text=json.dumps(output, ensure_ascii=False, indent=2))]
    except Exception as e:
        logger.error("Triage pipeline error: %s", e)
        return [TextContent(type="text", text=json.dumps({"error": str(e)}))]


async def main() -> None:
    """Start the MCP server over stdio."""
    setup_litellm()
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
