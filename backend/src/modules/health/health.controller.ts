import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Environment } from '../../config/environment';
import { DatabaseService } from '../../database/database.service';
import { Public } from '../auth/public.decorator';
import { resolveWorkerHealth } from '../operations/operational-health';
import {
  HealthResponseDto,
  ReadinessResponseDto,
} from './dto/health-response.dto';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Report API liveness' })
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth(): HealthResponseDto {
    return {
      service: 'gogymgo-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
    };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Report database and background-worker readiness',
  })
  @ApiOkResponse({ type: ReadinessResponseDto })
  async getReadiness(): Promise<ReadinessResponseDto> {
    try {
      const heartbeat = await this.database.connection
        .selectFrom('worker_heartbeats')
        .select([
          'last_completed_at',
          'last_failed_at',
          'last_started_at',
          'status',
        ])
        .where('worker_name', '=', 'operations')
        .executeTakeFirst();
      const worker = resolveWorkerHealth(
        heartbeat
          ? {
              lastCompletedAt: heartbeat.last_completed_at,
              lastFailedAt: heartbeat.last_failed_at,
              lastStartedAt: heartbeat.last_started_at,
              status: heartbeat.status,
            }
          : null,
        new Date(),
        this.config.get('WORKER_STALE_AFTER_MS', { infer: true }),
      ).status;

      if (worker === 'degraded' || worker === 'stale') {
        throw new ServiceUnavailableException({
          code: 'SERVICE_NOT_READY',
          message: 'The background worker is not ready.',
        });
      }

      return {
        ...this.getHealth(),
        dependencies: { database: 'ok', worker },
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException({
        code: 'SERVICE_NOT_READY',
        message: 'A required service dependency is not ready.',
      });
    }
  }
}
