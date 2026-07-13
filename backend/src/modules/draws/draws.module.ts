import { Module } from '@nestjs/common';
import { DrawsService } from './draws.service';

@Module({
  exports: [DrawsService],
  providers: [DrawsService],
})
export class DrawsModule {}
