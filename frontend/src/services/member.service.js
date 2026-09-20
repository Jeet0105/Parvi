import apiClient from './apiClient';

export function listMembers(familyId, { includeInactive = true } = {}) {
  return apiClient.get(`/families/${familyId}/members`, {
    params: { includeInactive: String(includeInactive) },
  });
}

export function addMember(familyId, payload) {
  return apiClient.post(`/families/${familyId}/members`, payload);
}

export function updateMember(memberId, payload) {
  return apiClient.put(`/members/${memberId}`, payload);
}

export function changeFamilyHead(familyId, memberId) {
  return apiClient.put(`/families/${familyId}/head`, { memberId });
}
