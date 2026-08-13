import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import type { Environment } from '../../config/environment';
import { AwsS3PrivateObjectStorage } from './aws-s3-private-object-storage';
import { PRIVATE_OBJECT_STORAGE } from './private-object-storage';

@Module({
  exports: [PRIVATE_OBJECT_STORAGE],
  providers: [
    {
      inject: [ConfigService],
      provide: PRIVATE_OBJECT_STORAGE,
      useFactory: (config: ConfigService<Environment, true>) =>
        new AwsS3PrivateObjectStorage(
          new S3Client({
            region: config.get('AWS_REGION', { infer: true }),
          }),
        ),
    },
  ],
})
export class PrivateObjectStorageModule {}
