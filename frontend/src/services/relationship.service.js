import apiClient from './apiClient';

export function listForFamily(familyId, { verificationStatus } = {}) {
  return apiClient.get(`/families/${familyId}/relationships`, {
    params: { verificationStatus },
  });
}

export function createRelationship({ fromMemberId, toMemberId, relationshipType }) {
  return apiClient.post('/relationships', {
    fromMemberId,
    toMemberId,
    relationshipType,
  });
}

export function listPending({ page = 1, pageSize = 25 } = {}) {
  return apiClient.get('/relationships/pending', { params: { page, pageSize } });
}

/** action is APPROVE, REJECT or REQUEST_DOCUMENT. */
export function verifyRelationship(id, { action, reason }) {
  return apiClient.put(`/relationships/${id}/verify`, { action, reason });
}
