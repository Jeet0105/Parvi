import axios from 'axios';

export const TOKEN_KEY = 'fip.token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be unavailable (private mode); the app still works for the
    // current page load because the token is held in memory by AuthContext.
  }
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Normalises every failure into the same shape the API already uses, so
 * components never have to dig through axios internals.
 */
export class ApiError extends Error {
  constructor(message, { status, errors, isNetworkError = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors || [];
    this.isNetworkError = isNetworkError;
  }

  /** Validation messages keyed by field name, for inline form errors. */
  get fieldErrors() {
    return Object.fromEntries(this.errors.map((e) => [e.field, e.message]));
  }
}

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (!error.response) {
      return Promise.reject(
        new ApiError('Cannot reach the server. Check your connection.', {
          isNetworkError: true,
        })
      );
    }

    const { status, data } = error.response;

    if (status === 401) {
      // The token is gone or expired; drop it so the app falls back to login.
      setToken(null);
    }

    return Promise.reject(
      new ApiError(data?.message || 'Something went wrong', {
        status,
        errors: data?.errors,
      })
    );
  }
);

export default apiClient;
