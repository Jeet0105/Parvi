const FAMILY_STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING_VERIFICATION: 'Pending verification',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

const VERIFICATION_LABELS = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

const MEMBER_STATUS_LABELS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  DECEASED: 'Deceased',
  MIGRATED: 'Migrated',
  SEPARATED: 'Separated',
};

export function familyStatusLabel(status) {
  return FAMILY_STATUS_LABELS[status] || status;
}

export function verificationLabel(status) {
  return VERIFICATION_LABELS[status] || status;
}

export function memberStatusLabel(status) {
  return MEMBER_STATUS_LABELS[status] || status;
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Whole years between a date of birth and today. */
export function ageFrom(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

export function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (Number.isNaN(number)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(number);
}

export const RELATIONSHIP_TYPES = [
  "FATHER",
  "MOTHER",
  "SON",
  "DAUGHTER",
  "SPOUSE",
  "BROTHER",
  "SISTER",
  "GRANDFATHER",
  "GRANDMOTHER",
  "GRANDSON",
  "GRANDDAUGHTER",
];

/** Title case for a relationship enum, e.g. GRANDFATHER -> Grandfather. */
export function relationshipLabel(type) {
  if (!type) return "";
  return type.charAt(0) + type.slice(1).toLowerCase();
}

/** Reads a relationship the way a person would say it aloud. */
export function describeRelationship({ fromMember, toMember, relationshipType }) {
  return fromMember?.name + " is the " + relationshipLabel(relationshipType).toLowerCase() + " of " + toMember?.name;
}
