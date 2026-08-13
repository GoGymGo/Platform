import type { MigrationBuilder } from 'node-pg-migrate';

const initialAcceptanceContext = '1970-01-01T00:00:00.000Z';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumn('account_legal_receipt_bundles', {
    acceptance_context_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func(`'${initialAcceptanceContext}'::timestamptz`),
    },
  });
  pgm.dropConstraint(
    'account_legal_receipt_bundles',
    'account_legal_receipt_bundles_user_hash_unique',
  );
  pgm.addConstraint(
    'account_legal_receipt_bundles',
    'account_legal_receipt_bundles_user_hash_context_unique',
    {
      unique: ['user_id', 'bundle_sha256', 'acceptance_context_at'],
    },
  );
  pgm.addConstraint(
    'legal_documents',
    'legal_documents_owner_approval_complete',
    {
      check:
        '(owner_approved_at IS NULL AND owner_approved_by_user_id IS NULL) OR ' +
        '(owner_approved_at IS NOT NULL AND owner_approved_by_user_id IS NOT NULL)',
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropConstraint(
    'legal_documents',
    'legal_documents_owner_approval_complete',
  );
  pgm.dropConstraint(
    'account_legal_receipt_bundles',
    'account_legal_receipt_bundles_user_hash_context_unique',
  );
  pgm.addConstraint(
    'account_legal_receipt_bundles',
    'account_legal_receipt_bundles_user_hash_unique',
    { unique: ['user_id', 'bundle_sha256'] },
  );
  pgm.dropColumn('account_legal_receipt_bundles', 'acceptance_context_at');
}
