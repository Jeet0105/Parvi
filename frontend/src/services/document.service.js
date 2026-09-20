import apiClient from './apiClient';

export function listForFamily(familyId, { verificationStatus } = {}) {
  return apiClient.get(`/families/${familyId}/documents`, {
    params: { verificationStatus },
  });
}

/**
 * Uploads one file. FormData sets its own multipart boundary, so the JSON
 * default Content-Type must be cleared for this request.
 */
export function uploadDocument({ memberId, documentType, relationshipId, file }) {
  const form = new FormData();
  form.append('memberId', memberId);
  form.append('documentType', documentType);
  if (relationshipId) form.append('relationshipId', relationshipId);
  form.append('file', file);

  return apiClient.post('/documents', form, {
    headers: { 'Content-Type': undefined },
  });
}

export function listPending({ page = 1, pageSize = 25 } = {}) {
  return apiClient.get('/documents/pending', { params: { page, pageSize } });
}

export function verifyDocument(id, { action, reason }) {
  return apiClient.put(`/documents/${id}/verify`, { action, reason });
}

/** Documents are served through an authorised route, never a public folder. */
export function fileUrl(id) {
  return `${apiClient.defaults.baseURL}/documents/${id}/file`;
}
