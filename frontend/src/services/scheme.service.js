import apiClient from './apiClient';

/** List all government schemes. */
export function listSchemes() {
  return apiClient.get('/schemes');
}

/** Get a single scheme by ID. */
export function getSchemeById(id) {
  return apiClient.get(`/schemes/${id}`);
}

/** Get eligible schemes for a family with per-member evaluation. */
export function getEligibleSchemes(familyId) {
  return apiClient.get(`/schemes/family/${familyId}/eligible`);
}
