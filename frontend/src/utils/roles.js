export const ROLES = {
  CITIZEN: 'CITIZEN',
  VERIFICATION_OFFICER: 'VERIFICATION_OFFICER',
  DISTRICT_OFFICER: 'DISTRICT_OFFICER',
  ADMIN: 'ADMIN',
};

export const OFFICER_ROLES = [
  ROLES.VERIFICATION_OFFICER,
  ROLES.DISTRICT_OFFICER,
  ROLES.ADMIN,
];

const ROLE_LABELS = {
  CITIZEN: 'Citizen',
  VERIFICATION_OFFICER: 'Verification Officer',
  DISTRICT_OFFICER: 'District Officer',
  ADMIN: 'Administrator',
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || 'Unknown';
}

/** Where each role lands after signing in. */
export function homePathForRole(role) {
  if (role === ROLES.CITIZEN) return '/dashboard';
  if (OFFICER_ROLES.includes(role)) return '/officer';
  return '/dashboard';
}
