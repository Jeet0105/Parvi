import apiClient from './apiClient';

export function register({ name, email, mobile, password }) {
  return apiClient.post('/auth/register', { name, email, mobile, password });
}

export function login({ email, password }) {
  return apiClient.post('/auth/login', { email, password });
}

/** Confirms the stored token is still valid and returns the current profile. */
export function me() {
  return apiClient.get('/auth/me');
}

export function health() {
  return apiClient.get('/health');
}
