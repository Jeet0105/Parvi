import apiClient from './apiClient';

/** Citizen submits their own family for officer review. */
export function submitFamily(familyId) {
  return apiClient.put(`/families/${familyId}/submit`);
}

export function listPendingFamilies({ page = 1, pageSize = 25 } = {}) {
  return apiClient.get('/verification/families/pending', {
    params: { page, pageSize },
  });
}

export function verifyFamily(familyId, { action, reason }) {
  return apiClient.put(`/verification/families/${familyId}`, { action, reason });
}

export function verifyMember(memberId, { action, reason }) {
  return apiClient.put(`/verification/members/${memberId}`, { action, reason });
}

export function getStatistics() {
  return apiClient.get('/dashboard/statistics');
}

export function getVerificationHistory({ page = 1, pageSize = 10 } = {}) {
  return apiClient.get('/dashboard/history', {
    params: { page, pageSize },
  });
}
