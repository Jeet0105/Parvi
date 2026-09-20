import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AuthProvider } from '../context/AuthContext';
import { TOKEN_KEY } from '../services/apiClient';
import { USER_KEY } from '../context/AuthContext';

/**
 * Renders a tree with routing and auth wired up.
 * Pass `user` to start the test from a signed-in session.
 */
export function renderWithProviders(
  ui,
  { route = '/', user = null, token = 'test-token' } = {}
) {
  if (user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
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
