import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    // 1. Rutas archivos JSON
    const metricsPath = path.join(process.cwd(), '..', 'docs', 'samples', 'system_metrics.json');
    const alertsPath = path.join(process.cwd(), '..', 'docs', 'samples', 'live_alerts.json');

    // 2. Leer archivos
    const metricsData = await fs.readFile(metricsPath, 'utf8');
    const alertsData = await fs.readFile(alertsPath, 'utf8');

    return NextResponse.json({
      metrics: JSON.parse(metricsData),
      alerts: JSON.parse(alertsData)
    });
  } catch (error) {
    return NextResponse.json({ error: "Error leyendo datos" }, { status: 500 });
  }
}