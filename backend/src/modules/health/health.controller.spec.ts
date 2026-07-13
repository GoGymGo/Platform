import { HealthController } from './health.controller';
import type { DatabaseService } from '../../database/database.service';

describe('HealthController', () => {
  it('reports API liveness without external dependencies', () => {
    const response = new HealthController({} as DatabaseService).getHealth();

    expect(response.service).toBe('gogymgo-api');
    expect(response.status).toBe('ok');
    expect(Number.isFinite(response.uptimeSeconds)).toBe(true);
    expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
  });
});
