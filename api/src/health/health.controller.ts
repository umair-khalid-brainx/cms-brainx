import { Controller, Get } from '@nestjs/common';
import { HealthRepository } from './health.repository.js';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthRepository) {}

  @Get()
  async check(): Promise<{ status: string; database: string; uptime: number }> {
    const database = (await this.health.ping()) ? 'up' : 'down';

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      uptime: Math.round(process.uptime()),
    };
  }
}
