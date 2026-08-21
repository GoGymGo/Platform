import { stableJson } from '../../common/idempotency/stable-json';
import {
  assembleLandingInterestArtifact,
  landingExportPageSignature,
  parseLandingInterestArtifact,
  parseLandingInterestExportPage,
  sha256,
  type LandingInterestExportPage,
  type LandingInterestRecord,
} from './landing-intake-artifact';

function record(
  id: string,
  createdAt: string,
  fullName: string,
): LandingInterestRecord {
  const unsigned = {
    audience: 'brand' as const,
    company_name: 'Example Co',
    consent: true,
    created_at: createdAt,
    discovery_source: null,
    email: 'partner@example.com',
    full_name: fullName,
    goal_days: null,
    id,
    message: null,
    partnership_interest: 'regional-sponsor',
    region: 'Victoria, BC',
    updated_at: createdAt,
    website: null,
    workout_style: null,
  };
  return { ...unsigned, source_record_sha256: sha256(stableJson(unsigned)) };
}

function page(
  sequence: number,
  requestCursor: string | null,
  nextCursor: string | null,
  results: LandingInterestRecord[],
): LandingInterestExportPage {
  const unsigned = {
    artifact_signature: landingExportPageSignature,
    cutoff_exclusive: '2026-08-21T12:00:00.000Z',
    export_id: '20000000-0000-4000-8000-000000000027',
    next_cursor: nextCursor,
    page_count: results.length,
    page_limit: 1,
    page_sequence: sequence,
    request_cursor: requestCursor,
    results,
    schema_version: 1 as const,
    source_count: 2,
  };
  return { ...unsigned, content_sha256: sha256(stableJson(unsigned)) };
}

describe('landing intake artifact validation', () => {
  it('assembles a complete page chain with reproducible counts and digests', () => {
    const pages = [
      page(1, null, 'opaque-page-two-cursor', [
        record('legacy-1', '2026-08-20T10:00:00.000Z', 'First Partner'),
      ]),
      page(2, 'opaque-page-two-cursor', null, [
        record('legacy-2', '2026-08-20T11:00:00.000Z', 'Second Partner'),
      ]),
    ].map(parseLandingInterestExportPage);

    const artifact = assembleLandingInterestArtifact(pages);

    expect(artifact).toMatchObject({
      duplicate_business_key_count: 1,
      page_count: 2,
      source_count: 2,
      unique_business_key_count: 1,
    });
    expect(artifact.artifact_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(parseLandingInterestArtifact(artifact)).toEqual(artifact);
  });

  it('rejects page, chain, count, and artifact tampering', () => {
    const first = page(1, null, 'opaque-page-two-cursor', [
      record('legacy-1', '2026-08-20T10:00:00.000Z', 'First Partner'),
    ]);
    expect(() =>
      parseLandingInterestExportPage({ ...first, source_count: 3 }),
    ).toThrow('digest');

    const parsedFirst = parseLandingInterestExportPage(first);
    const brokenSecond = parseLandingInterestExportPage(
      page(2, 'different-cursor', null, [
        record('legacy-2', '2026-08-20T11:00:00.000Z', 'Second Partner'),
      ]),
    );
    expect(() =>
      assembleLandingInterestArtifact([parsedFirst, brokenSecond]),
    ).toThrow('chain');

    const completeSecond = parseLandingInterestExportPage(
      page(2, 'opaque-page-two-cursor', null, [
        record('legacy-2', '2026-08-20T11:00:00.000Z', 'Second Partner'),
      ]),
    );
    const artifact = assembleLandingInterestArtifact([
      parsedFirst,
      completeSecond,
    ]);
    expect(() =>
      parseLandingInterestArtifact({
        ...artifact,
        duplicate_business_key_count: 0,
      }),
    ).toThrow();
  });
});
