import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  const timestamp = {
    type: 'timestamp with time zone',
    notNull: true,
    default: pgm.func('current_timestamp'),
  } as const;

  pgm.createType('legal_receipt_requirement', [
    'accept',
    'acknowledge',
    'none',
  ]);
  pgm.createType('legal_document_state', ['published', 'withdrawn']);
  pgm.createType('legal_receipt_action', ['accept', 'acknowledge']);

  pgm.createTable('legal_documents', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    document_key: { type: 'varchar(64)', notNull: true },
    jurisdiction_code: { type: 'varchar(16)', notNull: true },
    locale: { type: 'varchar(16)', notNull: true },
    version: { type: 'varchar(64)', notNull: true },
    title: { type: 'varchar(160)', notNull: true },
    content: { type: 'jsonb', notNull: true },
    content_sha256: { type: 'char(64)', notNull: true },
    receipt_requirement: {
      type: 'legal_receipt_requirement',
      notNull: true,
    },
    effective_at: { type: 'timestamp with time zone', notNull: true },
    created_at: timestamp,
  });
  pgm.addConstraint(
    'legal_documents',
    'legal_documents_key_jurisdiction_locale_version_unique',
    {
      unique: ['document_key', 'jurisdiction_code', 'locale', 'version'],
    },
  );
  pgm.addConstraint('legal_documents', 'legal_documents_key_valid', {
    check: "document_key ~ '^[a-z][a-z0-9_]{1,63}$'",
  });
  pgm.addConstraint('legal_documents', 'legal_documents_jurisdiction_valid', {
    check:
      "jurisdiction_code = 'GLOBAL' OR jurisdiction_code ~ '^[A-Z]{2}(-[A-Z0-9]{1,8})?$'",
  });
  pgm.addConstraint('legal_documents', 'legal_documents_locale_valid', {
    check: "locale ~ '^[a-z]{2}(-[A-Z]{2})?$'",
  });
  pgm.addConstraint('legal_documents', 'legal_documents_version_valid', {
    check: 'length(trim(version)) > 0',
  });
  pgm.addConstraint('legal_documents', 'legal_documents_title_valid', {
    check: 'length(trim(title)) > 0',
  });
  pgm.addConstraint('legal_documents', 'legal_documents_content_valid', {
    check: "jsonb_typeof(content) = 'object'",
  });
  pgm.addConstraint('legal_documents', 'legal_documents_hash_valid', {
    check: "content_sha256 ~ '^[0-9a-f]{64}$'",
  });
  pgm.createIndex('legal_documents', [
    'document_key',
    'jurisdiction_code',
    'locale',
    'effective_at',
  ]);

  pgm.createTable('legal_document_events', {
    id: { type: 'bigserial', primaryKey: true },
    legal_document_id: {
      type: 'uuid',
      notNull: true,
      references: 'legal_documents',
      onDelete: 'RESTRICT',
    },
    previous_state: { type: 'legal_document_state' },
    next_state: { type: 'legal_document_state', notNull: true },
    actor_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    reason: { type: 'text', notNull: true },
    request_id: { type: 'varchar(128)', notNull: true },
    created_at: timestamp,
  });
  pgm.addConstraint(
    'legal_document_events',
    'legal_document_events_request_unique',
    { unique: ['legal_document_id', 'request_id'] },
  );
  pgm.addConstraint(
    'legal_document_events',
    'legal_document_events_reason_valid',
    {
      check: 'length(trim(reason)) >= 8',
    },
  );
  pgm.createIndex('legal_document_events', [
    'legal_document_id',
    'created_at',
    'id',
  ]);

  pgm.createTable('account_legal_receipt_bundles', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    jurisdiction_code: { type: 'varchar(16)', notNull: true },
    locale: { type: 'varchar(16)', notNull: true },
    bundle_sha256: { type: 'char(64)', notNull: true },
    request_id: { type: 'varchar(128)', notNull: true },
    accepted_at: timestamp,
  });
  pgm.addConstraint(
    'account_legal_receipt_bundles',
    'account_legal_receipt_bundles_user_hash_unique',
    { unique: ['user_id', 'bundle_sha256'] },
  );
  pgm.addConstraint(
    'account_legal_receipt_bundles',
    'account_legal_receipt_bundles_jurisdiction_valid',
    {
      check:
        "jurisdiction_code = 'GLOBAL' OR jurisdiction_code ~ '^[A-Z]{2}(-[A-Z0-9]{1,8})?$'",
    },
  );
  pgm.addConstraint(
    'account_legal_receipt_bundles',
    'account_legal_receipt_bundles_locale_valid',
    { check: "locale ~ '^[a-z]{2}(-[A-Z]{2})?$'" },
  );
  pgm.addConstraint(
    'account_legal_receipt_bundles',
    'account_legal_receipt_bundles_hash_valid',
    { check: "bundle_sha256 ~ '^[0-9a-f]{64}$'" },
  );
  pgm.createIndex('account_legal_receipt_bundles', [
    'user_id',
    'jurisdiction_code',
    'locale',
    'accepted_at',
  ]);

  pgm.createTable('account_legal_receipts', {
    id: { type: 'bigserial', primaryKey: true },
    receipt_bundle_id: {
      type: 'uuid',
      notNull: true,
      references: 'account_legal_receipt_bundles',
      onDelete: 'RESTRICT',
    },
    legal_document_id: {
      type: 'uuid',
      notNull: true,
      references: 'legal_documents',
      onDelete: 'RESTRICT',
    },
    receipt_action: { type: 'legal_receipt_action', notNull: true },
    presented_content_sha256: { type: 'char(64)', notNull: true },
    accepted_at: timestamp,
  });
  pgm.addConstraint(
    'account_legal_receipts',
    'account_legal_receipts_bundle_document_unique',
    { unique: ['receipt_bundle_id', 'legal_document_id'] },
  );
  pgm.addConstraint(
    'account_legal_receipts',
    'account_legal_receipts_hash_valid',
    { check: "presented_content_sha256 ~ '^[0-9a-f]{64}$'" },
  );
  pgm.createIndex('account_legal_receipts', ['legal_document_id']);

  pgm.addColumns('competition_rule_acceptances', {
    account_legal_receipt_bundle_id: {
      type: 'uuid',
      references: 'account_legal_receipt_bundles',
      onDelete: 'RESTRICT',
    },
  });

  pgm.sql(`
    CREATE FUNCTION gogymgo_validate_account_legal_receipt()
    RETURNS trigger AS $$
    DECLARE
      expected_hash char(64);
      expected_action legal_receipt_requirement;
    BEGIN
      SELECT content_sha256, receipt_requirement
      INTO expected_hash, expected_action
      FROM legal_documents
      WHERE id = NEW.legal_document_id;

      IF expected_hash IS NULL THEN
        RAISE EXCEPTION 'legal document does not exist';
      END IF;
      IF expected_action = 'none' THEN
        RAISE EXCEPTION 'legal document does not accept a receipt';
      END IF;
      IF NEW.presented_content_sha256 <> expected_hash THEN
        RAISE EXCEPTION 'legal receipt content hash does not match';
      END IF;
      IF NEW.receipt_action::text <> expected_action::text THEN
        RAISE EXCEPTION 'legal receipt action does not match';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER account_legal_receipts_validate
    BEFORE INSERT ON account_legal_receipts
    FOR EACH ROW EXECUTE FUNCTION gogymgo_validate_account_legal_receipt();

    CREATE TRIGGER legal_documents_append_only
    BEFORE UPDATE OR DELETE ON legal_documents
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();

    CREATE TRIGGER legal_document_events_append_only
    BEFORE UPDATE OR DELETE ON legal_document_events
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();

    CREATE TRIGGER account_legal_receipt_bundles_append_only
    BEFORE UPDATE OR DELETE ON account_legal_receipt_bundles
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();

    CREATE TRIGGER account_legal_receipts_append_only
    BEFORE UPDATE OR DELETE ON account_legal_receipts
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropColumns('competition_rule_acceptances', [
    'account_legal_receipt_bundle_id',
  ]);
  pgm.sql(`
    DROP TRIGGER IF EXISTS account_legal_receipts_append_only ON account_legal_receipts;
    DROP TRIGGER IF EXISTS account_legal_receipt_bundles_append_only ON account_legal_receipt_bundles;
    DROP TRIGGER IF EXISTS legal_document_events_append_only ON legal_document_events;
    DROP TRIGGER IF EXISTS legal_documents_append_only ON legal_documents;
    DROP TRIGGER IF EXISTS account_legal_receipts_validate ON account_legal_receipts;
    DROP FUNCTION IF EXISTS gogymgo_validate_account_legal_receipt();
  `);
  pgm.dropTable('account_legal_receipts');
  pgm.dropTable('account_legal_receipt_bundles');
  pgm.dropTable('legal_document_events');
  pgm.dropTable('legal_documents');
  pgm.dropType('legal_receipt_action');
  pgm.dropType('legal_document_state');
  pgm.dropType('legal_receipt_requirement');
}
