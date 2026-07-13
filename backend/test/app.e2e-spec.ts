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

  it('keeps readiness public but fails closed without dependencies', () => {
    return request(app.getHttpServer())
      .get('/v1/health/ready')
      .expect(503)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({
            code: 'SERVICE_NOT_READY',
            path: '/v1/health/ready',
          }),
        });
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

  it('requires authentication before competition enrollment', () => {
    return request(app.getHttpServer())
      .post('/v1/competitions/10000000-0000-4000-8000-000000000001/enrollments')
      .set('Idempotency-Key', 'competition-enrollment-e2e')
      .send({
        ageEligibilityAttested: true,
        goalDays: 3,
        legalReceiptBundleId: '30000000-0000-4000-8000-000000000003',
        regionVerificationId: '20000000-0000-4000-8000-000000000002',
        rulesAccepted: true,
      })
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'AUTH_REQUIRED' }),
        });
      });
  });

  it('validates public legal document scope before database access', () => {
    return request(app.getHttpServer())
      .get('/v1/legal-documents/current?jurisdictionCode=INVALID_SCOPE')
      .expect(400)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
        });
      });
  });

  it('requires authentication before legal receipt status or submission', async () => {
    await request(app.getHttpServer())
      .get('/v1/me/legal-receipts/status?jurisdictionCode=CA-BC&locale=en-CA')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'AUTH_REQUIRED' }),
        });
      });
    await request(app.getHttpServer())
      .post('/v1/me/legal-receipts')
      .set('Idempotency-Key', 'legal-receipt-e2e')
      .send({})
      .expect(401);
  });

  it('requires authentication before legal document publication', () => {
    return request(app.getHttpServer())
      .post('/v1/operator/configuration/legal-documents')
      .set('Idempotency-Key', 'legal-publication-e2e')
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'AUTH_REQUIRED' }),
        });
      });
  });

  it('requires authentication before creating a private export download action', () => {
    return request(app.getHttpServer())
      .post(
        '/v1/me/privacy-requests/10000000-0000-4000-8000-000000000001/download-action',
      )
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'AUTH_REQUIRED' }),
        });
      });
  });

  it('requires authentication before creating or completing avatar uploads', async () => {
    await request(app.getHttpServer())
      .post('/v1/me/avatar-upload')
      .set('Idempotency-Key', 'avatar-e2e-upload')
      .send({ contentLength: 512, contentType: 'image/jpeg' })
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'AUTH_REQUIRED' }),
        });
      });
    await request(app.getHttpServer())
      .post(
        '/v1/me/avatar-upload/10000000-0000-4000-8000-000000000001/complete',
      )
      .expect(401);
  });

  it('requires an operator token before private avatar review access', () => {
    return request(app.getHttpServer())
      .get(
        '/v1/operator/profile-media/10000000-0000-4000-8000-000000000001/review-action',
      )
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'AUTH_REQUIRED' }),
        });
      });
  });

  it('requires authentication before administrative configuration changes', () => {
    return request(app.getHttpServer())
      .post('/v1/operator/configuration/competitions')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'AUTH_REQUIRED' }),
        });
      });
  });

  it('requires authentication before operational health access', () => {
    return request(app.getHttpServer())
      .get('/v1/operator/system-health')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'AUTH_REQUIRED' }),
        });
      });
  });

  it('validates public creator-workout region filters before database access', () => {
    return request(app.getHttpServer())
      .get('/v1/creator-workouts?region=NOT_VALID!')
      .expect(400)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
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
