import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

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

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      return NextResponse.json({ success: true, action: 'stop', status: 'STOPPED' });
    }

    const config = {
      ...currentConfig,
      speed,
      last_updated: new Date().toISOString(),
      status: 'RUNNING',
      mode: String(speed).toUpperCase() === 'MAX' ? 'fast-forward' : 'normal',
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    return NextResponse.json({ success: true, speed });
  } catch (error) {
    return NextResponse.json({ error: 'Error guardando config' }, { status: 500 });
  }
}