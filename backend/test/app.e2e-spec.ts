import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';

describe('platform foundation (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'test';
    process.env.OPENAPI_ENABLED = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  it('/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/v1/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({ service: 'gogymgo-api', status: 'ok' }),
        );
      });
  });

  it('returns the stable error envelope for missing routes', () => {
    return request(app.getHttpServer())
      .get('/v1/not-a-route')
      .set('x-request-id', 'e2e-request-id')
      .expect(404)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({
            code: 'HTTP_404',
            path: '/v1/not-a-route',
            requestId: 'e2e-request-id',
          }),
        });
      });
  });

  it('requires a verified bearer token before account data access', () => {
    return request(app.getHttpServer())
      .get('/v1/me')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'AUTH_REQUIRED' }),
        });
      });
  });

  it('requires authentication before payout claim access', () => {
    return request(app.getHttpServer())
      .get('/v1/payout-claims/me')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'AUTH_REQUIRED' }),
        });
      });
  });

  it('keeps the provider webhook closed when Hyperwallet is disabled', () => {
    return request(app.getHttpServer())
      .post('/v1/webhooks/hyperwallet')
      .send({ token: 'wbn-test', type: 'PAYMENTS.UPDATED' })
      .expect(503)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({
            code: 'PAYOUT_PROVIDER_UNAVAILABLE',
          }),
        });
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
