import { Module } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { GoogleCloudPrivateObjectStorage } from './google-cloud-private-object-storage';
import { PRIVATE_OBJECT_STORAGE } from './private-object-storage';

@Module({
  exports: [PRIVATE_OBJECT_STORAGE],
  providers: [
    {
      provide: PRIVATE_OBJECT_STORAGE,
      useFactory: () => new GoogleCloudPrivateObjectStorage(new Storage()),
    },
  ],
})
export class PrivateObjectStorageModule {}
