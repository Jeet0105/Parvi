import apiClient from './apiClient';

/** List audit log entries with optional filters. */
export function listAuditLogs({ page = 1, pageSize = 25, entityType, action } = {}) {
  return apiClient.get('/audit', {
    params: { page, pageSize, entityType, action },
  });
}

/** Get audit history for a specific entity. */
export function getEntityAudit(entityType, entityId) {
  return apiClient.get(`/audit/${entityType}/${entityId}`);
}
