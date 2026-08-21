import type { MigrationBuilder } from 'node-pg-migrate';

const liveCandidateIndex = 'profile_media_one_live_candidate_per_user';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('profile_media', {
    content_sha256: { type: 'char(64)' },
    image_height: { type: 'integer' },
    image_width: { type: 'integer' },
    inspection_version: { type: 'varchar(32)' },
    storage_version_id: { type: 'varchar(1024)' },
  });
  // Media accepted by the previous prefix-only inspection cannot be promoted
  // into the stricter presentation path. Revoke it transactionally and let the
  // existing durable cleanup queue remove the private object.
  pgm.sql(`
    UPDATE profiles AS profile
    SET
      avatar_object_key = NULL,
      updated_at = current_timestamp,
      version = profile.version + 1
    FROM profile_media AS media
    WHERE profile.avatar_object_key = media.object_key
      AND media.status = 'approved'
      AND media.inspection_version IS NULL
  `);
  pgm.sql(`
    UPDATE profile_media
    SET
      status = CASE
        WHEN status = 'pending_review'
          THEN 'superseded'::profile_media_status
        ELSE 'removed'::profile_media_status
      END,
      review_version = review_version + 1,
      updated_at = current_timestamp
    WHERE status IN ('pending_review', 'approved')
      AND inspection_version IS NULL
  `);
  pgm.addConstraint('profile_media', 'profile_media_object_owned', {
    check: "object_key LIKE 'avatars/' || user_id::text || '/%'",
  });
  pgm.addConstraint('profile_media', 'profile_media_inspection_consistent', {
    check: `
      (
        content_sha256 IS NULL
        AND image_height IS NULL
        AND image_width IS NULL
        AND inspection_version IS NULL
      ) OR (
        content_sha256 ~ '^[a-f0-9]{64}$'
        AND image_height BETWEEN 64 AND 2048
        AND image_width BETWEEN 64 AND 2048
        AND image_height * image_width <= 4194304
        AND inspection_version = 'avatar-image-v1'
      )
    `,
  });
  pgm.addConstraint('profile_media', 'profile_media_review_state_inspected', {
    check: `
      status NOT IN ('pending_review', 'approved') OR (
        content_sha256 IS NOT NULL
        AND image_height IS NOT NULL
        AND image_width IS NOT NULL
        AND inspection_version = 'avatar-image-v1'
        AND storage_generation IS NOT NULL
      )
    `,
  });
  // Older disabled-pilot rows can predate the one-live-candidate invariant.
  // Preserve the newest candidate and make every older row immediately
  // non-presentable before the unique index is created.
  pgm.sql(`
    WITH ranked_candidates AS (
      SELECT
        id,
        status,
        row_number() OVER (
          PARTITION BY user_id
          ORDER BY created_at DESC, id DESC
        ) AS candidate_rank
      FROM profile_media
      WHERE status IN ('pending_upload', 'pending_review')
    )
    UPDATE profile_media AS media
    SET
      status = CASE
        WHEN ranked.status = 'pending_upload'
          THEN 'removed'::profile_media_status
        ELSE 'superseded'::profile_media_status
      END,
      review_version = media.review_version + 1,
      updated_at = current_timestamp
    FROM ranked_candidates AS ranked
    WHERE media.id = ranked.id
      AND ranked.candidate_rank > 1
  `);
  pgm.createIndex('profile_media', ['user_id'], {
    name: liveCandidateIndex,
    unique: true,
    where: "status IN ('pending_upload', 'pending_review')",
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex('profile_media', ['user_id'], {
    ifExists: true,
    name: liveCandidateIndex,
  });
  pgm.dropConstraint('profile_media', 'profile_media_inspection_consistent', {
    ifExists: true,
  });
  pgm.dropConstraint('profile_media', 'profile_media_review_state_inspected', {
    ifExists: true,
  });
  pgm.dropConstraint('profile_media', 'profile_media_object_owned', {
    ifExists: true,
  });
  pgm.dropColumns(
    'profile_media',
    [
      'content_sha256',
      'image_height',
      'image_width',
      'inspection_version',
      'storage_version_id',
    ],
    { ifExists: true },
  );
}
