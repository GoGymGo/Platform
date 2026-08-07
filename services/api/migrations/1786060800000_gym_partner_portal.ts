import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  const timestamp = {
    type: 'timestamp with time zone',
    notNull: true,
    default: pgm.func('current_timestamp'),
  } as const;

  pgm.dropConstraint('competitions', 'competitions_region_month_unique');

  pgm.createTable('gym_partner_assignments', {
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    gym_location_id: {
      type: 'uuid',
      notNull: true,
      references: 'gym_locations',
      onDelete: 'CASCADE',
    },
    access_level: { type: 'varchar(16)', notNull: true },
    active: { type: 'boolean', notNull: true, default: true },
    assigned_by_user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'RESTRICT',
    },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.addConstraint('gym_partner_assignments', 'gym_partner_assignments_pk', {
    primaryKey: ['user_id', 'gym_location_id'],
  });
  pgm.addConstraint(
    'gym_partner_assignments',
    'gym_partner_assignments_access_level',
    { check: "access_level IN ('admin', 'staff')" },
  );
  pgm.createIndex('gym_partner_assignments', ['gym_location_id', 'active']);

  pgm.createTable('partner_competition_proposals', {
    competition_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'competitions',
      onDelete: 'CASCADE',
    },
    gym_location_id: {
      type: 'uuid',
      notNull: true,
      references: 'gym_locations',
      onDelete: 'RESTRICT',
    },
    proposed_by_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    month_key: { type: 'varchar(7)', notNull: true },
    created_at: timestamp,
    updated_at: timestamp,
  });
  pgm.createIndex('partner_competition_proposals', [
    'gym_location_id',
    'created_at',
  ]);
  pgm.addConstraint(
    'partner_competition_proposals',
    'partner_competition_proposals_gym_month_unique',
    { unique: ['gym_location_id', 'month_key'] },
  );
  pgm.addConstraint(
    'partner_competition_proposals',
    'partner_competition_proposals_month_key_format',
    { check: "month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'" },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('partner_competition_proposals');
  pgm.dropTable('gym_partner_assignments');
  pgm.addConstraint('competitions', 'competitions_region_month_unique', {
    unique: ['region_policy_id', 'month_key'],
  });
}
