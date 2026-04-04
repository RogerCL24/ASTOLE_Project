import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

type AllowedSpeed = 1 | 2 | 4 | 'MAX';

function normalizeSpeed(speed: unknown): AllowedSpeed | null {
  if (speed === 'MAX' || speed === 'max') return 'MAX';
  if (typeof speed === 'string') {
    const trimmed = speed.trim();
    if (trimmed.toUpperCase() === 'MAX') return 'MAX';
    const asNumber = Number(trimmed);
    if (asNumber === 1 || asNumber === 2 || asNumber === 4) return asNumber as AllowedSpeed;
    return null;
  }
  if (speed === 1 || speed === 2 || speed === 4) return speed;
  return null;
}

async function atomicWriteJson(filePath: string, payload: unknown) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmpPath = path.join(dir, `.${base}.${Date.now()}.tmp`);
  await fs.writeFile(tmpPath, JSON.stringify(payload, null, 2));
  await fs.rename(tmpPath, filePath);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { speed, action } = body;

    const configPath = path.join(process.cwd(), '..', 'simulation_config.json');
    const currentConfig = await fs.readFile(configPath, 'utf8').then((content) => JSON.parse(content)).catch(() => ({}));

    if (action === 'stop') {
      const config = {
        ...currentConfig,
        action: 'stop',
        status: 'STOPPED',
        last_updated: new Date().toISOString(),
        mode: 'stopped',
      };

      await atomicWriteJson(configPath, config);

      return NextResponse.json({ success: true, action: 'stop', status: 'STOPPED' });
    }

    if (action != null) {
      return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
    }

    const normalizedSpeed = normalizeSpeed(speed);
    if (normalizedSpeed == null) {
      return NextResponse.json(
        { error: 'Velocidad no soportada. Valores permitidos: 1, 2, 4, MAX' },
        { status: 400 }
      );
    }

    const config = {
      ...currentConfig,
      speed: normalizedSpeed,
      action: null,
      last_updated: new Date().toISOString(),
      status: 'RUNNING',
      mode: normalizedSpeed === 'MAX' ? 'fast-forward' : 'normal',
    };

    await atomicWriteJson(configPath, config);

    return NextResponse.json({ success: true, speed: normalizedSpeed });
  } catch (error) {
    return NextResponse.json({ error: 'Error guardando config' }, { status: 500 });
  }
}