import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

let lastGoodMetrics: unknown | null = null;
let lastGoodAlerts: unknown = [];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJsonWithRetry(filePath: string, fallback: unknown) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return fallback;
      }

      const isParseError = error instanceof SyntaxError;
      if (isParseError && attempt < maxAttempts) {
        await delay(25);
        continue;
      }

      throw error;
    }
  }

  return fallback;
}

export async function GET() {
  // 1. Rutas archivos JSON
  const metricsPath = path.join(process.cwd(), '..', 'docs', 'samples', 'system_metrics.json');
  const alertsPath = path.join(process.cwd(), '..', 'docs', 'samples', 'live_alerts.json');

  try {
    const [metrics, alerts] = await Promise.all([
      readJsonWithRetry(metricsPath, lastGoodMetrics ?? null),
      readJsonWithRetry(alertsPath, lastGoodAlerts ?? []),
    ]);

    lastGoodMetrics = metrics;
    lastGoodAlerts = alerts;

    return NextResponse.json({ metrics, alerts });
  } catch (error) {
    return NextResponse.json(
      {
        metrics: lastGoodMetrics ?? null,
        alerts: lastGoodAlerts ?? [],
        error: 'Error leyendo datos',
      },
      { status: 200 }
    );
  }
}