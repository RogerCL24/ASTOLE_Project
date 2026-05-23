/**
 * Proxy Next.js → Investigator API (puerto 8003)
 * frontend/app/api/investigator/route.ts
 * Mismo patrón que /api/stats
 */

import { NextRequest } from "next/server";

const INVESTIGATOR_URL = "http://localhost:8003/chat";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(INVESTIGATOR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Error del investigator" }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Pasar el stream SSE directamente al frontend
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "No se pudo conectar con el investigator" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}