import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.addConstraint('payout_claims', 'payout_claims_version_positive', {
    check: 'version > 0',
  });

  pgm.sql(`
    CREATE FUNCTION gogymgo_enforce_payout_claim_integrity()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.draw_winner_id IS DISTINCT FROM OLD.draw_winner_id
         OR NEW.user_id IS DISTINCT FROM OLD.user_id
         OR NEW.provider IS DISTINCT FROM OLD.provider
         OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
         OR NEW.currency IS DISTINCT FROM OLD.currency
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'payout claim financial identity is immutable';
      END IF;

      IF NEW.version <> OLD.version + 1 THEN
        RAISE EXCEPTION 'payout claim version must increment exactly once';
      END IF;

      IF NOT (
        (OLD.status = 'pending_review' AND NEW.status IN ('action_required', 'cancelled', 'failed'))
        OR (OLD.status = 'action_required' AND NEW.status IN ('verification_pending', 'ready', 'cancelled', 'failed'))
        OR (OLD.status = 'verification_pending' AND NEW.status IN ('action_required', 'ready', 'cancelled', 'failed'))
        OR (OLD.status = 'ready' AND NEW.status IN ('action_required', 'processing', 'cancelled', 'failed'))
        OR (OLD.status = 'processing' AND NEW.status IN ('action_required', 'verification_pending', 'paid', 'failed'))
        OR (OLD.status = 'failed' AND NEW.status IN ('action_required', 'cancelled'))
      ) THEN
        RAISE EXCEPTION 'invalid payout claim state transition from % to %', OLD.status, NEW.status;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER payout_claims_financial_integrity
    BEFORE UPDATE ON payout_claims
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_payout_claim_integrity();

    CREATE FUNCTION gogymgo_enforce_payout_payment_identity()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.payout_claim_id IS DISTINCT FROM OLD.payout_claim_id
         OR NEW.client_payment_id IS DISTINCT FROM OLD.client_payment_id
         OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
         OR NEW.currency IS DISTINCT FROM OLD.currency
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'payout payment financial identity is immutable';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER payout_payments_financial_identity
    BEFORE UPDATE ON payout_payments
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_payout_payment_identity();

    CREATE FUNCTION gogymgo_enforce_hyperwallet_user_identity()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.user_id IS DISTINCT FROM OLD.user_id
         OR NEW.program_token IS DISTINCT FROM OLD.program_token
         OR NEW.provider_user_token IS DISTINCT FROM OLD.provider_user_token
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Hyperwallet payee identity is immutable';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER hyperwallet_users_provider_identity
    BEFORE UPDATE ON hyperwallet_users
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_hyperwallet_user_identity();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS hyperwallet_users_provider_identity ON hyperwallet_users;
    DROP FUNCTION IF EXISTS gogymgo_enforce_hyperwallet_user_identity();
    DROP TRIGGER IF EXISTS payout_payments_financial_identity ON payout_payments;
    DROP FUNCTION IF EXISTS gogymgo_enforce_payout_payment_identity();
    DROP TRIGGER IF EXISTS payout_claims_financial_integrity ON payout_claims;
    DROP FUNCTION IF EXISTS gogymgo_enforce_payout_claim_integrity();
  `);
  pgm.dropConstraint('payout_claims', 'payout_claims_version_positive');
}
