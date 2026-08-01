import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { DatabaseService } from '../src/database/database.service';

describe('platform foundation (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.OPENAPI_ENABLED = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue({
        connection: {
          selectFrom: () => {
            throw new Error('Database dependency is unavailable in e2e tests.');
          },
        },
      })
      .compile();

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

  it('requires authentication before streak reward access', () => {
    return request(app.getHttpServer())
      .get('/v1/streaks/me')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'AUTH_REQUIRED' }),
        });
      });
  });

  it('requires authentication before cancelling a workout session', () => {
    return request(app.getHttpServer())
      .post('/v1/sessions/10000000-0000-4000-8000-000000000001/cancel')
      .set('Idempotency-Key', 'session-cancel-e2e')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'AUTH_REQUIRED' }),
        });
      });
  });

  it('requires authentication across friend and challenge routes', async () => {
    await request(app.getHttpServer())
      .get('/v1/social/users?screenName=GHOST')
      .expect(401);
    await request(app.getHttpServer())
      .get('/v1/social/friend-requests')
      .expect(401);
    await request(app.getHttpServer())
      .get('/v1/social/challenges/discover?regionCode=toronto-on')
      .expect(401);
    await request(app.getHttpServer())
      .post('/v1/social/challenges')
      .set('Idempotency-Key', 'social-challenge-e2e')
      .send({ name: 'July Strength Sprint' })
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'AUTH_REQUIRED' }),
        });
      });
    await request(app.getHttpServer())
      .post('/v1/social/challenges/10000000-0000-4000-8000-000000000001/join')
      .set('Idempotency-Key', 'social-challenge-join-e2e')
      .expect(401);
    await request(app.getHttpServer())
      .post(
        '/v1/social/challenges/10000000-0000-4000-8000-000000000001/check-ins',
      )
      .set('Idempotency-Key', 'social-challenge-check-in-e2e')
      .expect(401);
  });

  it('requires authentication before reward award access', () => {
    return request(app.getHttpServer())
      .get('/v1/rewards/awards/me')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'AUTH_REQUIRED' }),
        });
      });
  });

  it('requires an operator token before reward configuration access', () => {
    return request(app.getHttpServer())
      .post('/v1/operator/configuration/rewards')
      .set('Idempotency-Key', 'reward-create-e2e')
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'AUTH_REQUIRED' }),
        });
      });
  });

  it('requires an operator token before reward fulfillment changes', () => {
    return request(app.getHttpServer())
      .post(
        '/v1/operator/reward-awards/10000000-0000-4000-8000-000000000001/status-action',
      )
      .set('Idempotency-Key', 'reward-status-e2e')
      .send({ action: 'redeem', reason: 'Confirm sponsor redemption.' })
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'AUTH_REQUIRED' }),
        });
      });
  });

  it('requires authentication before a reward claim', async () => {
    await request(app.getHttpServer())
      .post('/v1/rewards/awards/10000000-0000-4000-8000-000000000001/claim')
      .set('Idempotency-Key', 'reward-claim-e2e')
      .expect(401);
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

  it('requires an operator token before session evidence review access', async () => {
    await request(app.getHttpServer())
      .get('/v1/operator/sessions/10000000-0000-4000-8000-000000000001/review')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: expect.objectContaining({ code: 'AUTH_REQUIRED' }),
        });
      });
    await request(app.getHttpServer())
      .post('/v1/operator/sessions/10000000-0000-4000-8000-000000000001/reject')
      .set('Idempotency-Key', 'reject-session-e2e')
      .send({})
      .expect(401);
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

  it('requires authentication before the administrative dashboard', () => {
    return request(app.getHttpServer())
      .get('/v1/operator/configuration/dashboard')
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

  it.each([
    '/v1/creator-workouts',
    '/v1/creator-workouts?region=NOT_VALID!',
    '/v1/competitions/2026-08/enrollment-count',
    '/v1/competitions/2026-08/enrollment-count?region=VANCOUVER',
  ])(
    'validates canonical public region filters before database access: %s',
    (path) => {
      return request(app.getHttpServer())
        .get(path)
        .expect(400)
        .expect(({ body }) => {
          expect(body).toEqual({
            error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
          });
        });
    },
  );

  it('does not expose the removed provider webhook route', () => {
    return request(app.getHttpServer())
      .post('/v1/webhooks/hyperwallet')
      .expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
