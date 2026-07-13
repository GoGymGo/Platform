import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'kysely';
import type { Selectable, Transaction } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { Environment } from '../../config/environment';
import { DatabaseService } from '../../database/database.service';
import type {
  Database,
  JsonObject,
  PayoutClaimsTable,
} from '../../database/database.types';
import type { PayoutClaimStatus } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { ProfilesService } from '../profiles/profiles.service';
import type {
  OperatorPayoutClaimResponseDto,
  PayoutClaimResponseDto,
  PortalActionResponseDto,
} from './dto/payout.dto';
import { toSafeAmountMinor } from './dto/payout.dto';
import type {
  HyperwalletClient,
  HyperwalletUser,
} from './hyperwallet/hyperwallet.types';
import { HYPERWALLET_CLIENT } from './hyperwallet/hyperwallet.types';
import { assertSupportedPayoutCurrency } from './hyperwallet/money';
import { assertPayoutTransition } from './payout-state-machine';
import { payoutStatusFromPaymentStatus } from './provider-status';

interface SettledWinner {
  amountMinor: bigint | number | string;
  currency: string;
  id: string;
  userId: string;
}

interface OperatorPayoutJson extends JsonObject {
  id: string;
  status: PayoutClaimStatus;
  version: number;
}

interface TransitionOptions {
  approvedByUserId?: string;
  eventId: string;
  failureCode?: string | null;
  metadata?: JsonObject;
  nextStatus: PayoutClaimStatus;
  source: string;
}

@Injectable()
export class PayoutsService {
  private readonly programToken: string | undefined;

  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly notifications: NotificationsService,
    private readonly profiles: ProfilesService,
    config: ConfigService<Environment, true>,
    @Inject(HYPERWALLET_CLIENT)
    private readonly hyperwallet: HyperwalletClient,
  ) {
    this.programToken = config.get('HYPERWALLET_PROGRAM_TOKEN', {
      infer: true,
    });
  }

  async createClaimsForWinners(
    transaction: Transaction<Database>,
    winners: readonly SettledWinner[],
  ): Promise<number> {
    if (winners.length === 0) {
      return 0;
    }

    const now = new Date();
    const claims = await transaction
      .insertInto('payout_claims')
      .values(
        winners.map((winner) => ({
          amount_minor: winner.amountMinor,
          approved_at: null,
          approved_by_user_id: null,
          created_at: now,
          currency: winner.currency,
          draw_winner_id: winner.id,
          failure_code: null,
          paid_at: null,
          provider: 'hyperwallet' as const,
          status: 'pending_review' as const,
          updated_at: now,
          user_id: winner.userId,
          version: 1,
        })),
      )
      .onConflict((conflict) => conflict.column('draw_winner_id').doNothing())
      .returning(['draw_winner_id', 'id', 'status'])
      .execute();

    if (claims.length > 0) {
      await transaction
        .insertInto('payout_state_events')
        .values(
          claims.map((claim) => ({
            created_at: now,
            metadata: {},
            next_status: claim.status,
            payout_claim_id: claim.id,
            previous_status: null,
            source: 'draw_settlement',
            source_event_id: claim.draw_winner_id,
          })),
        )
        .execute();
    }

    return claims.length;
  }

  async getMyClaim(
    principal: AuthenticatedPrincipal,
  ): Promise<PayoutClaimResponseDto | null> {
    const claim = await this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        return transaction
          .selectFrom('payout_claims as claim')
          .innerJoin(
            'draw_winners as winner',
            'winner.id',
            'claim.draw_winner_id',
          )
          .innerJoin('competition_draws as draw', 'draw.id', 'winner.draw_id')
          .innerJoin(
            'competitions as competition',
            'competition.id',
            'draw.competition_id',
          )
          .select([
            'claim.amount_minor',
            'claim.currency',
            'claim.id',
            'claim.provider',
            'claim.status',
            'competition.name as competition_name',
          ])
          .where('claim.user_id', '=', user.id)
          .where('claim.status', 'in', [
            'action_required',
            'verification_pending',
            'ready',
            'processing',
            'paid',
          ])
          .orderBy('claim.created_at', 'desc')
          .executeTakeFirst();
      });

    if (!claim) {
      return null;
    }

    assertSupportedPayoutCurrency(claim.currency);
    return {
      amountMinor: toSafeAmountMinor(claim.amount_minor),
      competitionLabel: claim.competition_name,
      currency: claim.currency,
      id: claim.id,
      provider: 'hyperwallet',
      status:
        claim.status === 'processing'
          ? 'ready'
          : claim.status.replace('_', '-'),
    } as PayoutClaimResponseDto;
  }

  async openPortal(
    principal: AuthenticatedPrincipal,
    claimId: string,
    idempotencyKey: string,
  ): Promise<PortalActionResponseDto> {
    const context = await this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const claim = await transaction
          .selectFrom('payout_claims as claim')
          .innerJoin(
            'draw_winners as winner',
            'winner.id',
            'claim.draw_winner_id',
          )
          .innerJoin('competition_draws as draw', 'draw.id', 'winner.draw_id')
          .innerJoin(
            'competitions as competition',
            'competition.id',
            'draw.competition_id',
          )
          .innerJoin(
            'region_policies as region',
            'region.id',
            'competition.region_policy_id',
          )
          .select([
            'claim.id',
            'claim.status',
            'region.country_code',
            'region.payout_enabled',
          ])
          .where('claim.id', '=', claimId)
          .where('claim.user_id', '=', user.id)
          .executeTakeFirst();
        if (!claim) {
          throw new NotFoundException({
            code: 'PAYOUT_CLAIM_NOT_FOUND',
            message: 'The payout claim was not found.',
          });
        }
        if (!claim.payout_enabled) {
          throw new ConflictException({
            code: 'PAYOUT_REGION_UNAVAILABLE',
            message: 'Payouts are not enabled for this competition region.',
          });
        }
        this.profiles.requireVerifiedEmail(user);
        if (
          ![
            'action_required',
            'verification_pending',
            'ready',
            'processing',
          ].includes(claim.status)
        ) {
          throw new ConflictException({
            code: 'PAYOUT_PORTAL_UNAVAILABLE',
            message:
              'This payout claim does not currently require portal access.',
          });
        }

        return {
          country: claim.country_code,
          email: user.email,
          status: claim.status,
          userId: user.id,
        };
      });

    await this.ensureProviderUser(
      context.userId,
      context.email,
      context.country,
    );

    if (context.status === 'action_required') {
      await this.database.connection
        .transaction()
        .execute(async (transaction) => {
          const current = await transaction
            .selectFrom('payout_claims')
            .select('status')
            .where('id', '=', claimId)
            .forUpdate()
            .executeTakeFirstOrThrow();
          if (current.status === 'action_required') {
            await this.transitionClaim(transaction, claimId, {
              eventId: idempotencyKey,
              metadata: {},
              nextStatus: 'verification_pending',
              source: 'payee_portal_opened',
            });
          }
        });
    }

    return { portalUrl: this.hyperwallet.getPortalUrl() };
  }

  async approve(
    principal: AuthenticatedPrincipal,
    claimId: string,
    idempotencyKey: string,
    reason: string,
  ): Promise<OperatorPayoutClaimResponseDto> {
    const result = await this.idempotency.execute<OperatorPayoutJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { claimId, reason },
        scope: 'operator:payout-claims:approve',
      },
      async (transaction) => {
        const operator = await this.profiles.ensureUser(principal, transaction);
        this.profiles.requireVerifiedEmail(operator);
        this.assertPayoutOperator(operator.roles);
        const claim = await this.transitionClaim(transaction, claimId, {
          approvedByUserId: operator.id,
          eventId: idempotencyKey,
          metadata: { reason },
          nextStatus: 'action_required',
          source: 'operator_approval',
        });
        await this.notifications.enqueue(
          transaction,
          claim.user_id,
          'payout_action_required',
          { claimId: claim.id },
        );
        await this.appendOperatorAudit(transaction, {
          action: 'payout_claim.approved',
          actorUserId: operator.id,
          claim,
          reason,
          requestId: idempotencyKey,
        });
        return { id: claim.id, status: claim.status, version: claim.version };
      },
    );

    return result;
  }

  async release(
    principal: AuthenticatedPrincipal,
    claimId: string,
    idempotencyKey: string,
    reason: string,
  ): Promise<OperatorPayoutClaimResponseDto> {
    const reservation = await this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const operator = await this.profiles.ensureUser(principal, transaction);
        this.profiles.requireVerifiedEmail(operator);
        this.assertPayoutOperator(operator.roles);
        const claim = await transaction
          .selectFrom('payout_claims')
          .selectAll()
          .where('id', '=', claimId)
          .forUpdate()
          .executeTakeFirst();
        if (!claim) {
          throw new NotFoundException({
            code: 'PAYOUT_CLAIM_NOT_FOUND',
            message: 'The payout claim was not found.',
          });
        }
        if (claim.status === 'processing' || claim.status === 'paid') {
          return {
            amountMinor: claim.amount_minor,
            claim,
            currency: claim.currency,
            destinationToken: null,
            shouldSubmit: false,
          };
        }
        if (claim.status !== 'ready') {
          throw new ConflictException({
            code: 'PAYOUT_CLAIM_NOT_READY',
            message: 'Only a ready payout claim can be released.',
          });
        }

        const providerUser = await transaction
          .selectFrom('hyperwallet_users')
          .select('provider_user_token')
          .where('user_id', '=', claim.user_id)
          .where('program_token', '=', this.requireProgramToken())
          .executeTakeFirst();
        if (!providerUser) {
          throw new ConflictException({
            code: 'PAYOUT_ACCOUNT_NOT_CONNECTED',
            message: 'The winner must complete payout setup before release.',
          });
        }

        const processingClaim = await this.transitionClaim(
          transaction,
          claim.id,
          {
            eventId: idempotencyKey,
            metadata: { reason },
            nextStatus: 'processing',
            source: 'operator_release',
          },
        );
        await transaction
          .insertInto('payout_payments')
          .values({
            amount_minor: claim.amount_minor,
            client_payment_id: claim.id,
            created_at: new Date(),
            currency: claim.currency,
            payout_claim_id: claim.id,
            provider_payment_token: null,
            provider_status: 'SUBMITTING',
            updated_at: new Date(),
          })
          .onConflict((conflict) =>
            conflict.column('payout_claim_id').doNothing(),
          )
          .execute();
        await this.appendOperatorAudit(transaction, {
          action: 'payout_claim.released',
          actorUserId: operator.id,
          claim: processingClaim,
          reason,
          requestId: idempotencyKey,
        });

        return {
          amountMinor: claim.amount_minor,
          claim: processingClaim,
          currency: claim.currency,
          destinationToken: providerUser.provider_user_token,
          shouldSubmit: true,
        };
      });

    if (!reservation.shouldSubmit || !reservation.destinationToken) {
      return {
        id: reservation.claim.id,
        status: reservation.claim.status,
        version: reservation.claim.version,
      };
    }

    assertSupportedPayoutCurrency(reservation.currency);
    try {
      const payment = await this.hyperwallet.createPayment({
        amountMinor: reservation.amountMinor,
        clientPaymentId: claimId,
        currency: reservation.currency,
        destinationToken: reservation.destinationToken,
      });
      return await this.database.connection
        .transaction()
        .execute(async (transaction) => {
          await transaction
            .updateTable('payout_payments')
            .set({
              provider_payment_token: payment.token,
              provider_status: payment.status,
              updated_at: new Date(),
            })
            .where('payout_claim_id', '=', claimId)
            .executeTakeFirstOrThrow();
          const nextStatus = payoutStatusFromPaymentStatus(payment.status);
          const claim = await this.transitionClaim(transaction, claimId, {
            eventId: payment.token,
            failureCode: nextStatus === 'failed' ? payment.status : null,
            metadata: { providerStatus: payment.status },
            nextStatus,
            source: 'hyperwallet_payment_create',
          });
          return { id: claim.id, status: claim.status, version: claim.version };
        });
    } catch (error) {
      await this.database.connection
        .updateTable('payout_payments')
        .set({
          provider_status: 'SUBMISSION_UNCERTAIN',
          updated_at: new Date(),
        })
        .where('payout_claim_id', '=', claimId)
        .execute();
      throw error;
    }
  }

  async reconcileUncertainPayments(limit = 25): Promise<number> {
    const payments = await this.database.connection
      .selectFrom('payout_payments')
      .select(['client_payment_id', 'id', 'payout_claim_id'])
      .where('provider_status', 'in', ['SUBMITTING', 'SUBMISSION_UNCERTAIN'])
      .orderBy('updated_at')
      .limit(limit)
      .execute();
    let reconciled = 0;
    for (const stored of payments) {
      try {
        const payment = await this.hyperwallet.findPaymentByClientPaymentId(
          stored.client_payment_id,
        );
        if (!payment) {
          continue;
        }
        await this.database.connection
          .transaction()
          .execute(async (transaction) => {
            await transaction
              .updateTable('payout_payments')
              .set({
                provider_payment_token: payment.token,
                provider_status: payment.status,
                updated_at: new Date(),
              })
              .where('id', '=', stored.id)
              .executeTakeFirstOrThrow();
            const nextStatus = payoutStatusFromPaymentStatus(payment.status);
            await this.transitionClaim(transaction, stored.payout_claim_id, {
              eventId: payment.token,
              failureCode: nextStatus === 'failed' ? payment.status : null,
              metadata: {
                providerStatus: payment.status,
                reconciliation: true,
              },
              nextStatus,
              source: 'hyperwallet_payment_reconciliation',
            });
          });
        reconciled += 1;
      } catch {
        // Keep the payment uncertain for the next bounded reconciliation pass.
      }
    }
    return reconciled;
  }

  async transitionClaim(
    transaction: Transaction<Database>,
    claimId: string,
    options: TransitionOptions,
  ): Promise<Selectable<PayoutClaimsTable>> {
    const current = await transaction
      .selectFrom('payout_claims')
      .selectAll()
      .where('id', '=', claimId)
      .forUpdate()
      .executeTakeFirst();
    if (!current) {
      throw new NotFoundException({
        code: 'PAYOUT_CLAIM_NOT_FOUND',
        message: 'The payout claim was not found.',
      });
    }
    if (current.status === options.nextStatus) {
      return current;
    }

    assertPayoutTransition(current.status, options.nextStatus);
    const now = new Date();
    const updated = await transaction
      .updateTable('payout_claims')
      .set({
        ...(options.approvedByUserId
          ? {
              approved_at: now,
              approved_by_user_id: options.approvedByUserId,
            }
          : {}),
        failure_code:
          options.nextStatus === 'failed'
            ? (options.failureCode ?? 'PROVIDER_FAILURE')
            : null,
        paid_at: options.nextStatus === 'paid' ? now : current.paid_at,
        status: options.nextStatus,
        updated_at: now,
        version: sql<number>`version + 1`,
      })
      .where('id', '=', current.id)
      .where('version', '=', current.version)
      .returningAll()
      .executeTakeFirstOrThrow();
    await transaction
      .insertInto('payout_state_events')
      .values({
        created_at: now,
        metadata: options.metadata ?? {},
        next_status: updated.status,
        payout_claim_id: updated.id,
        previous_status: current.status,
        source: options.source,
        source_event_id: options.eventId,
      })
      .executeTakeFirstOrThrow();

    return updated;
  }

  private async ensureProviderUser(
    userId: string,
    email: string,
    country: string,
  ): Promise<HyperwalletUser> {
    const programToken = this.requireProgramToken();
    const existing = await this.database.connection
      .selectFrom('hyperwallet_users')
      .select(['provider_status', 'provider_user_token'])
      .where('program_token', '=', programToken)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (existing) {
      return {
        status: existing.provider_status,
        token: existing.provider_user_token,
      };
    }

    let providerUser = await this.hyperwallet.findUserByClientUserId(userId);
    if (!providerUser) {
      try {
        providerUser = await this.hyperwallet.createUser({
          clientUserId: userId,
          country,
          email,
        });
      } catch (error) {
        providerUser = await this.hyperwallet.findUserByClientUserId(userId);
        if (!providerUser) {
          throw error;
        }
      }
    }

    const now = new Date();
    await this.database.connection
      .insertInto('hyperwallet_users')
      .values({
        created_at: now,
        program_token: programToken,
        provider_status: providerUser.status,
        provider_user_token: providerUser.token,
        updated_at: now,
        user_id: userId,
      })
      .onConflict((conflict) =>
        conflict.columns(['program_token', 'user_id']).doNothing(),
      )
      .execute();

    return providerUser;
  }

  private requireProgramToken(): string {
    if (!this.programToken) {
      throw new ConflictException({
        code: 'PAYOUT_PROVIDER_UNAVAILABLE',
        message: 'The payout provider is not configured in this environment.',
      });
    }
    return this.programToken;
  }

  private assertPayoutOperator(roles: readonly string[]): void {
    if (
      !roles.some((role) =>
        ['admin', 'operator', 'payout_operator'].includes(role),
      )
    ) {
      throw new ForbiddenException({
        code: 'PAYOUT_OPERATOR_REQUIRED',
        message: 'A payout-operator role is required for this action.',
      });
    }
  }

  private async appendOperatorAudit(
    transaction: Transaction<Database>,
    input: {
      action: string;
      actorUserId: string;
      claim: Selectable<PayoutClaimsTable>;
      reason: string;
      requestId: string;
    },
  ): Promise<void> {
    await transaction
      .insertInto('operator_audit_events')
      .values({
        action: input.action,
        actor_user_id: input.actorUserId,
        created_at: new Date(),
        entity_id: input.claim.id,
        entity_type: 'payout_claims',
        next_state: {
          status: input.claim.status,
          version: input.claim.version,
        },
        previous_state: null,
        reason: input.reason,
        request_id: input.requestId,
      })
      .executeTakeFirstOrThrow();
  }
}
