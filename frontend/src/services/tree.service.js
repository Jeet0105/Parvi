import apiClient from './apiClient';

export function getFamilyTree(familyId, { verificationStatus } = {}) {
  return apiClient.get(`/families/${familyId}/tree`, {
    params: { verificationStatus },
  });
}
