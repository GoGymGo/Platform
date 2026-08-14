export type PartnerAccessLevel = 'admin' | 'staff';

export function partnerAssignmentNeedsChange(input: {
  accessLevel: PartnerAccessLevel;
  action: 'grant' | 'revoke';
  previous: { accessLevel: PartnerAccessLevel; active: boolean } | null;
}): boolean {
  if (input.action === 'revoke') return input.previous?.active === true;
  return (
    !input.previous ||
    !input.previous.active ||
    input.previous.accessLevel !== input.accessLevel
  );
}

export function rolesForActivePartnerAssignments(
  currentRoles: string[],
  activeLevels: PartnerAccessLevel[],
): string[] {
  const preserved = currentRoles.filter(
    (role) => role !== 'gym_partner_admin' && role !== 'gym_partner_staff',
  );
  return [
    ...preserved,
    ...(activeLevels.includes('admin') ? ['gym_partner_admin'] : []),
    ...(activeLevels.includes('staff') ? ['gym_partner_staff'] : []),
  ].sort();
}
