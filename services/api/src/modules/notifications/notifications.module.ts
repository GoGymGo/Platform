import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProfilesModule } from '../profiles/profiles.module';
import { createExpoPushClient, EXPO_PUSH_CLIENT } from './expo-push.client';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  exports: [NotificationsService],
  imports: [ProfilesModule],
  providers: [
    {
      inject: [ConfigService],
      provide: EXPO_PUSH_CLIENT,
      useFactory: createExpoPushClient,
    },
    NotificationsService,
  ],
})
export class NotificationsModule {}
