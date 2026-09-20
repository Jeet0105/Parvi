/**
 * Duplicate Detection Worker.
 *
 * Processes duplicate detection in background jobs when new members are added
 * or when an administrator requests a whole-system scan.
 */
const { registerWorker, DUPLICATE_QUEUE_NAME } = require('./queue');
const duplicateService = require('../services/duplicate.service');

function initDuplicateWorker() {
  registerWorker(DUPLICATE_QUEUE_NAME, async (job) => {
    const { name, data } = job;

    if (name === 'check-member-duplicates') {
      const { memberId } = data;
      if (!memberId) return;
      try {
        const results = await duplicateService.findDuplicatesForMember(memberId);
        // Save duplicate review flags if score is high
        for (const match of results) {
          if (match.score >= 70) {
            await duplicateService.createReviewCandidate({
              sourceMemberId: memberId,
              matchedMemberId: match.matchedMember.id,
              score: match.score,
              breakdown: match.breakdown,
            });
          }
        }
      } catch (err) {
        console.error(`Worker error checking duplicates for member ${memberId}:`, err.message);
      }
    } else if (name === 'scan-all-duplicates') {
      try {
        await duplicateService.scanAll();
      } catch (err) {
        console.error('Worker error running full duplicate scan:', err.message);
      }
    }
  });
}

module.exports = {
  initDuplicateWorker,
};
