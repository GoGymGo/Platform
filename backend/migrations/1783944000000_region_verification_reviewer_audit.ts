import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    WITH latest_decisions AS (
      SELECT DISTINCT ON (entity_id)
        entity_id,
        actor_user_id
      FROM operator_audit_events
      WHERE action = 'region_verification.decided'
        AND entity_type = 'region_verifications'
      ORDER BY entity_id, created_at DESC, id DESC
    )
    UPDATE region_verifications AS verification
    SET reviewed_by_user_id = decision.actor_user_id
    FROM latest_decisions AS decision
    WHERE verification.id = decision.entity_id
      AND verification.status IN ('approved', 'rejected')
      AND verification.reviewed_by_user_id IS NULL;
  `);
}

export function down(): void {
  // Reviewer attribution is audit data and must not be erased on rollback.
}
