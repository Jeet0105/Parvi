const crypto = require('node:crypto');

/**
 * Alphabet without characters that are easily confused when a Family ID is
 * read aloud at a counter or copied off a printed form: no 0/O, 1/I/L, 5/S, 8/B.
 */
const ALPHABET = '234679ACDEFGHJKMNPQRTUVWXYZ';
const CODE_LENGTH = 8;

const STATE_CODES = {
  gujarat: 'GJ',
  maharashtra: 'MH',
  rajasthan: 'RJ',
  'madhya pradesh': 'MP',
  karnataka: 'KA',
  'tamil nadu': 'TN',
  kerala: 'KL',
  punjab: 'PB',
  haryana: 'HR',
  'uttar pradesh': 'UP',
  bihar: 'BR',
  'west bengal': 'WB',
  delhi: 'DL',
  goa: 'GA',
};

/** Two-letter code for a state name, falling back to its first two letters. */
function stateCode(state) {
  const key = String(state || '').trim().toLowerCase();
  if (STATE_CODES[key]) return STATE_CODES[key];

  const letters = key.replace(/[^a-z]/g, '').toUpperCase();
  return (letters.slice(0, 2) || 'XX').padEnd(2, 'X');
}

/**
 * Generates the random portion using rejection sampling, so every character
 * is uniformly distributed rather than skewed by a modulo bias.
 */
function randomCode(length = CODE_LENGTH) {
  const max = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let code = '';

  while (code.length < length) {
    for (const byte of crypto.randomBytes(length)) {
      if (byte >= max) continue;
      code += ALPHABET[byte % ALPHABET.length];
      if (code.length === length) break;
    }
  }
  return code;
}

/**
 * Builds a Family ID such as `GJ-FAM-8A72K91X`.
 *
 * The identifier is deliberately random: it carries no Aadhaar, no date of
 * birth, no district and nothing else derived from the family, so it stays
 * stable when they move and reveals nothing if it leaks.
 */
function generateFamilyId(state = 'Gujarat') {
  return `${stateCode(state)}-FAM-${randomCode()}`;
}

const FAMILY_ID_PATTERN = new RegExp(`^[A-Z]{2}-FAM-[${ALPHABET}]{${CODE_LENGTH}}$`);

module.exports = {
  generateFamilyId,
  stateCode,
  randomCode,
  ALPHABET,
  CODE_LENGTH,
  FAMILY_ID_PATTERN,
};
