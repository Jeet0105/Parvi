const {
  generateFamilyId,
  stateCode,
  randomCode,
  ALPHABET,
  CODE_LENGTH,
  FAMILY_ID_PATTERN,
} = require('../../src/utils/familyId');

describe('generateFamilyId', () => {
  it('produces the documented shape', () => {
    expect(generateFamilyId('Gujarat')).toMatch(/^GJ-FAM-[A-Z0-9]{8}$/);
    expect(generateFamilyId('Gujarat')).toMatch(FAMILY_ID_PATTERN);
  });

  it('maps known states to their code', () => {
    expect(generateFamilyId('Gujarat').startsWith('GJ-')).toBe(true);
    expect(generateFamilyId('Maharashtra').startsWith('MH-')).toBe(true);
    expect(generateFamilyId('Tamil Nadu').startsWith('TN-')).toBe(true);
  });

  it('falls back to the first two letters of an unknown state', () => {
    expect(stateCode('Narnia')).toBe('NA');
    expect(stateCode('')).toBe('XX');
    expect(stateCode(undefined)).toBe('XX');
    expect(stateCode('A')).toBe('AX');
  });

  it('is case and whitespace insensitive on the state name', () => {
    expect(stateCode('  gUjArAt  ')).toBe('GJ');
  });

  it('defaults to Gujarat when no state is given', () => {
    expect(generateFamilyId().startsWith('GJ-')).toBe(true);
  });
});

describe('Family ID safety properties', () => {
  it('excludes characters that are confused when read aloud', () => {
    for (const char of '01OILSB58') {
      expect(ALPHABET).not.toContain(char);
    }
  });

  it('contains no Aadhaar-like run of digits', () => {
    // A 12-digit sequence would suggest an Aadhaar number was embedded.
    for (let i = 0; i < 200; i += 1) {
      expect(generateFamilyId('Gujarat')).not.toMatch(/\d{12}/);
    }
  });

  it('encodes nothing about the family beyond the state', () => {
    // Same inputs, different identifiers: the ID is not derived from the data.
    const first = generateFamilyId('Gujarat');
    const second = generateFamilyId('Gujarat');
    expect(first).not.toBe(second);
  });

  it('does not collide across a large sample', () => {
    const seen = new Set();
    for (let i = 0; i < 20000; i += 1) {
      seen.add(generateFamilyId('Gujarat'));
    }
    expect(seen.size).toBe(20000);
  });

  it('uses the whole alphabet roughly evenly', () => {
    // Guards against a modulo bias that would shrink the real keyspace.
    const counts = new Map();
    const samples = 20000;

    for (let i = 0; i < samples; i += 1) {
      for (const char of randomCode()) {
        counts.set(char, (counts.get(char) || 0) + 1);
      }
    }

    expect(counts.size).toBe(ALPHABET.length);

    const expected = (samples * CODE_LENGTH) / ALPHABET.length;
    for (const count of counts.values()) {
      // Generous bound: catches systematic bias, not ordinary randomness.
      expect(count).toBeGreaterThan(expected * 0.85);
      expect(count).toBeLessThan(expected * 1.15);
    }
  });

  it('always produces the requested length', () => {
    for (let i = 0; i < 500; i += 1) {
      expect(randomCode()).toHaveLength(CODE_LENGTH);
    }
    expect(randomCode(4)).toHaveLength(4);
    expect(randomCode(20)).toHaveLength(20);
  });
});
