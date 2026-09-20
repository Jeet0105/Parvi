import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { AuthProvider, USER_KEY } from '../context/AuthContext';
import { TOKEN_KEY } from '../services/apiClient';
import * as authApi from '../services/auth.service';

/**
 * Renders a tree with routing and auth wired up.
 *
 * Pass `user` to start from a signed-in session. When the auth service is
 * mocked, `me()` is stubbed to echo that user so the provider's session
 * revalidation resolves the way a live backend would. Tests that care about
 * revalidation failing can override `authApi.me` afterwards.
 */
export function renderWithProviders(
  ui,
  { route = '/', user = null, token = 'test-token' } = {}
) {
  if (user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  // Always restate the stub for the user being rendered; a previous render in
  // the same test would otherwise leave /auth/me echoing the wrong account.
  if (user && vi.isMockFunction(authApi.me)) {
    authApi.me.mockResolvedValue({ data: { user } });
  }

  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}

export const citizen = {
  id: 'user-1',
  name: 'Rahul Patel',
  email: 'rahul@example.com',
  mobile: '9876543210',
  role: 'CITIZEN',
};

export const officer = {
  id: 'user-2',
  name: 'Officer Mehta',
  email: 'officer@example.gov',
  mobile: '9876500000',
  role: 'VERIFICATION_OFFICER',
};

export const admin = {
  id: 'user-3',
  name: 'System Administrator',
  email: 'admin@example.gov',
  mobile: '9876500001',
  role: 'ADMIN',
};
