import {
  partnerAssignmentNeedsChange,
  rolesForActivePartnerAssignments,
} from './trusted-partner-access';

describe('trusted partner access planning', () => {
  it('treats exact grants and completed revocations as idempotent no-ops', () => {
    expect(
      partnerAssignmentNeedsChange({
        accessLevel: 'admin',
        action: 'grant',
        previous: { accessLevel: 'admin', active: true },
      }),
    ).toBe(false);
    expect(
      partnerAssignmentNeedsChange({
        accessLevel: 'staff',
        action: 'revoke',
        previous: { accessLevel: 'staff', active: false },
      }),
    ).toBe(false);
    expect(
      partnerAssignmentNeedsChange({
        accessLevel: 'staff',
        action: 'revoke',
        previous: null,
      }),
    ).toBe(false);
  });

  it('changes grants, upgrades, and active revocations exactly once', () => {
    expect(
      partnerAssignmentNeedsChange({
        accessLevel: 'staff',
        action: 'grant',
        previous: null,
      }),
    ).toBe(true);
    expect(
      partnerAssignmentNeedsChange({
        accessLevel: 'admin',
        action: 'grant',
        previous: { accessLevel: 'staff', active: true },
      }),
    ).toBe(true);
    expect(
      partnerAssignmentNeedsChange({
        accessLevel: 'staff',
        action: 'revoke',
        previous: { accessLevel: 'staff', active: true },
      }),
    ).toBe(true);
  });

  it('derives global partner role flags without promoting exact gym levels', () => {
    expect(
      rolesForActivePartnerAssignments(['user'], ['admin', 'staff']),
    ).toEqual(['gym_partner_admin', 'gym_partner_staff', 'user']);
    expect(
      rolesForActivePartnerAssignments(
        ['gym_partner_admin', 'gym_partner_staff', 'user'],
        ['staff'],
      ),
    ).toEqual(['gym_partner_staff', 'user']);
    expect(
      rolesForActivePartnerAssignments(['gym_partner_staff', 'user'], []),
    ).toEqual(['user']);
  });
});
