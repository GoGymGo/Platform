import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from 'kysely';
import { DatabaseService } from '../../database/database.service';
import { HealthResponseDto } from './dto/health-response.dto';
import { Public } from '../auth/public.decorator';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

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
    summary: 'Report whether the API database dependency is ready',
  })
  @ApiOkResponse({ type: HealthResponseDto })
  async getReadiness(): Promise<HealthResponseDto> {
    try {
      await sql`select 1`.execute(this.database.connection);
    } catch {
      throw new ServiceUnavailableException({
        code: 'SERVICE_NOT_READY',
        message: 'The API database dependency is not ready.',
      });
    }
    return this.getHealth();
  }
}
