import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './dto/health-response.dto';
import { Public } from '../auth/public.decorator';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
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
}
