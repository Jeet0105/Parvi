import apiClient from './apiClient';

export function listDuplicates({ status = 'PENDING_REVIEW', page = 1, pageSize = 20 } = {}) {
  return apiClient.get('/duplicates', {
    params: { status, page, pageSize },
  });
}

export function decideDuplicate(id, { decision, reviewNote }) {
  return apiClient.put(`/duplicates/${id}`, { decision, reviewNote });
}

export function triggerScan() {
  return apiClient.post('/duplicates/scan');
}
