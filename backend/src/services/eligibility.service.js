/**
 * Rule-based eligibility engine for Government Welfare Schemes.
 */

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return 0;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Evaluates whether an individual family member meets the criteria of a scheme rule.
 *
 * Supported rule properties:
 * - minAge: number
 * - maxAge: number
 * - isStudent: boolean
 * - gender: 'MALE' | 'FEMALE' | 'OTHER'
 * - maxIncome: number (checked against family.annualIncome)
 * - ownsHouse: boolean (checked against family.ownsHouse)
 */
function evaluateMember(member, family, rule = {}) {
  const memberAge = calculateAge(member.dateOfBirth);
  const reasons = [];

  if (rule.minAge !== undefined && memberAge < rule.minAge) {
    reasons.push(`Must be at least ${rule.minAge} years old (current age: ${memberAge})`);
  }

  if (rule.maxAge !== undefined && memberAge > rule.maxAge) {
    reasons.push(`Must be under ${rule.maxAge} years old (current age: ${memberAge})`);
  }

  if (rule.isStudent !== undefined && Boolean(member.isStudent) !== Boolean(rule.isStudent)) {
    reasons.push(`Must be an active student`);
  }

  if (rule.gender && member.gender !== rule.gender) {
    reasons.push(`Restricted to gender: ${rule.gender}`);
  }

  const annualIncome = family?.annualIncome !== null && family?.annualIncome !== undefined
    ? Number(family.annualIncome)
    : 0;

  if (rule.maxIncome !== undefined && annualIncome > rule.maxIncome) {
    reasons.push(
      `Family annual income must not exceed ₹${rule.maxIncome.toLocaleString('en-IN')} (current: ₹${annualIncome.toLocaleString('en-IN')})`
    );
  }

  if (rule.ownsHouse !== undefined && Boolean(family?.ownsHouse) !== Boolean(rule.ownsHouse)) {
    reasons.push(
      rule.ownsHouse ? 'Must currently own a house' : 'Must not already own a permanent house'
    );
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    memberAge,
  };
}

module.exports = {
  calculateAge,
  evaluateMember,
};
