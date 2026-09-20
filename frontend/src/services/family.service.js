import apiClient from './apiClient';

/** The signed-in citizen's family, or null if they have not registered one. */
export function getMyFamily() {
  return apiClient.get('/families/mine');
}

export function getFamily(id) {
  return apiClient.get(`/families/${id}`);
}

export function createFamily(payload) {
  return apiClient.post('/families', payload);
}

export function updateFamily(id, payload) {
  return apiClient.put(`/families/${id}`, payload);
}

export function listFamilies({ status, district, page = 1, pageSize = 25 } = {}) {
  return apiClient.get('/families', {
    params: { status, district, page, pageSize },
  });
}
