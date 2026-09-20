import apiClient from './apiClient';

export function listUsers({ role, district, page = 1, pageSize = 25 } = {}) {
  return apiClient.get('/users', {
    params: { role, district, page, pageSize },
  });
}

export function updateUserRole(id, role) {
  return apiClient.put(`/users/${id}/role`, { role });
}
