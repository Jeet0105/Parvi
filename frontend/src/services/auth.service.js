import apiClient from './apiClient';

export function register({ name, email, mobile, password }) {
  return apiClient.post('/auth/register', { name, email, mobile, password });
}

export function login({ email, password }) {
  return apiClient.post('/auth/login', { email, password });
}

export function health() {
  return apiClient.get('/health');
}
