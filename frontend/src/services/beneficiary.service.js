import apiClient from './apiClient';

/** Apply a family member for a scheme. */
export function applyForScheme({ schemeId, memberId }) {
  return apiClient.post('/beneficiaries/apply', { schemeId, memberId });
}

/** List the logged-in citizen's own applications. */
export function myApplications() {
  return apiClient.get('/beneficiaries/mine');
}

/** Officer: list all applications with optional status filter. */
export function listApplications({ status, page = 1, pageSize = 25 } = {}) {
  return apiClient.get('/beneficiaries', {
    params: { status, page, pageSize },
  });
}

/** Officer: approve or reject an application. */
export function reviewApplication(id, { action, decisionReason }) {
  return apiClient.patch(`/beneficiaries/${id}/review`, { action, decisionReason });
}
