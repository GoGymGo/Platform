import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { S3Client } from '@aws-sdk/client-s3';
import type { Environment } from '../../config/environment';
import { AwsS3PrivateObjectStorage } from './aws-s3-private-object-storage';
import { GoogleCloudPrivateObjectStorage } from './google-cloud-private-object-storage';
import { PRIVATE_OBJECT_STORAGE } from './private-object-storage';

@Module({
  exports: [PRIVATE_OBJECT_STORAGE],
  providers: [
    {
      inject: [ConfigService],
      provide: PRIVATE_OBJECT_STORAGE,
      useFactory: (config: ConfigService<Environment, true>) => {
        if (
          config.get('PRIVATE_OBJECT_STORAGE_PROVIDER', { infer: true }) ===
          'aws-s3'
        ) {
          return new AwsS3PrivateObjectStorage(
            new S3Client({
              region: config.get('AWS_REGION', { infer: true }),
            }),
          );
        }
        return new GoogleCloudPrivateObjectStorage(new Storage());
      },
    },
  ],
})
export class PrivateObjectStorageModule {}
