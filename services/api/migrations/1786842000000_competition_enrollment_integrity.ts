import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE FUNCTION gogymgo_enforce_competition_enrollment_integrity()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      IF ROW(
        NEW.competition_id,
        NEW.user_id,
        NEW.goal_days,
        NEW.gym_location_id,
        NEW.gym_credential_version,
        NEW.region_verification_id,
        NEW.rules_acceptance_id,
        NEW.enrolled_at
      ) IS DISTINCT FROM ROW(
        OLD.competition_id,
        OLD.user_id,
        OLD.goal_days,
        OLD.gym_location_id,
        OLD.gym_credential_version,
        OLD.region_verification_id,
        OLD.rules_acceptance_id,
        OLD.enrolled_at
      ) THEN
        RAISE EXCEPTION 'Competition enrollment identity, evidence, and Weekly Goal are immutable.';
      END IF;

      IF NEW.status = OLD.status THEN
        RETURN NEW;
      END IF;

      IF OLD.status = 'active' AND NEW.status IN ('withdrawn', 'disqualified') THEN
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'Competition enrollment status is terminal and cannot be reversed or changed.';
    END;
    $function$;
  `);
  pgm.sql(`
    CREATE TRIGGER competition_enrollments_integrity
    BEFORE UPDATE ON competition_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION gogymgo_enforce_competition_enrollment_integrity();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(
    'DROP TRIGGER IF EXISTS competition_enrollments_integrity ON competition_enrollments;',
  );
  pgm.dropFunction('gogymgo_enforce_competition_enrollment_integrity', []);
}
