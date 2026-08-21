import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  DecideCreatorSubmissionDto,
  DecidePartnerApplicationDto,
  DecidePrivacyRequestDto,
  DecideProfileMediaDto,
  DecideRegionVerificationDto,
  RejectSessionDto,
  VerifySessionDto,
} from './operator.dto';

const reason = 'Reviewed against the current authoritative evidence.';
const evidence = {
  evidenceSnapshotSha256: 'a'.repeat(64),
  findings: {
    deviceAttestation: 'approved',
    gymQr: 'approved',
    heartRate: 'not_required',
    presenceCheck: 'approved',
  },
};

describe('versioned review decision DTOs', () => {
  type DtoConstructor = new () => object;
  const cases: Array<[DtoConstructor, Record<string, unknown>]> = [
    [DecideRegionVerificationDto, { decision: 'approved' }],
    [DecidePartnerApplicationDto, { decision: 'in_review' }],
    [DecideCreatorSubmissionDto, { decision: 'rejected' }],
    [DecidePrivacyRequestDto, { decision: 'processing' }],
    [DecideProfileMediaDto, { decision: 'approved' }],
    [VerifySessionDto, evidence],
    [RejectSessionDto, evidence],
  ];

  it.each(cases)(
    '%p accepts a positive expected version and rejects stale-shaped versions',
    async (Dto, decision) => {
      const valid = { ...decision, expectedVersion: 3, reason };
      await expect(validate(plainToInstance(Dto, valid))).resolves.toHaveLength(
        0,
      );
      for (const expectedVersion of [undefined, 0, -1, 1.5]) {
        const errors = await validate(
          plainToInstance(Dto, { ...valid, expectedVersion }),
        );
        expect(errors.map((error) => error.property)).toContain(
          'expectedVersion',
        );
      }
    },
  );

  it.each<DtoConstructor>([
    DecideRegionVerificationDto,
    DecidePartnerApplicationDto,
    DecideCreatorSubmissionDto,
    DecidePrivacyRequestDto,
    DecideProfileMediaDto,
  ])('%p rejects an undeclared transition', async (Dto) => {
    const errors = await validate(
      plainToInstance(Dto, {
        decision: 'force_complete',
        expectedVersion: 1,
        reason,
      }),
    );
    expect(errors.map((error) => error.property)).toContain('decision');
  });
});
