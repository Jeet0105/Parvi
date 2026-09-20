/**
 * String and demographic similarity utilities for explainable duplicate detection.
 */

/**
 * Normalises text for comparison: lowercases, removes non-alphanumeric chars, and trims.
 */
function cleanString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Calculates Levenshtein Distance between two strings.
 */
function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

/**
 * Returns string similarity percentage (0 - 100).
 */
function stringSimilarity(str1, str2) {
  const s1 = cleanString(str1);
  const s2 = cleanString(str2);

  if (!s1 && !s2) return 100;
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 100;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 100;

  const dist = levenshteinDistance(s1, s2);
  const similarity = ((maxLen - dist) / maxLen) * 100;
  return Math.round(Math.max(0, Math.min(100, similarity)));
}

/**
 * Compares two dates of birth and returns similarity (0 - 100).
 */
function dobSimilarity(d1, d2) {
  if (!d1 || !d2) return 0;
  const date1 = new Date(d1);
  const date2 = new Date(d2);

  if (Number.isNaN(date1.getTime()) || Number.isNaN(date2.getTime())) return 0;

  const y1 = date1.getUTCFullYear();
  const y2 = date2.getUTCFullYear();
  const m1 = date1.getUTCMonth();
  const m2 = date2.getUTCMonth();
  const day1 = date1.getUTCDate();
  const day2 = date2.getUTCDate();

  // Exact same day, month, year
  if (y1 === y2 && m1 === m2 && day1 === day2) return 100;

  // Same day and month, different year (e.g. transcription typo)
  if (m1 === m2 && day1 === day2 && Math.abs(y1 - y2) <= 2) return 85;

  // Same year, same month, day off by <= 3 days
  if (y1 === y2 && m1 === m2 && Math.abs(day1 - day2) <= 3) return 80;

  // Same year, different month
  if (y1 === y2) return 50;

  // Within 1 year
  if (Math.abs(y1 - y2) === 1) return 25;

  return 0;
}

/**
 * Calculates a multi-field weighted similarity score between two member records.
 *
 * Weights:
 * - Name: 35%
 * - Date of Birth: 30%
 * - Father Name: 20%
 * - Address / Location: 15%
 */
function calculateMemberSimilarity(m1, m2) {
  const nameScore = stringSimilarity(m1.name, m2.name);
  const dobScore = dobSimilarity(m1.dateOfBirth, m2.dateOfBirth);
  const fatherScore = stringSimilarity(m1.fatherName, m2.fatherName);

  // Address comparison based on family village + taluka + district
  const addr1 = `${m1.family?.village || ''} ${m1.family?.taluka || ''} ${m1.family?.district || ''}`;
  const addr2 = `${m2.family?.village || ''} ${m2.family?.taluka || ''} ${m2.family?.district || ''}`;
  const addressScore = stringSimilarity(addr1, addr2);

  const breakdown = {
    name: nameScore,
    dateOfBirth: dobScore,
    fatherName: fatherScore,
    address: addressScore,
  };

  const totalScore = Math.round(
    nameScore * 0.35 +
    dobScore * 0.30 +
    fatherScore * 0.20 +
    addressScore * 0.15
  );

  return {
    score: totalScore,
    breakdown,
  };
}

module.exports = {
  stringSimilarity,
  dobSimilarity,
  calculateMemberSimilarity,
};
