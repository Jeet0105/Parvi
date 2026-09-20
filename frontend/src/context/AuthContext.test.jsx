import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import App from '../App';
import { ApiError, TOKEN_KEY } from '../services/apiClient';
import * as authApi from '../services/auth.service';
import { USER_KEY } from './AuthContext';
import { renderWithProviders, citizen, officer } from '../test/renderWithProviders';

vi.mock('../services/auth.service');

beforeEach(() => {
  vi.resetAllMocks();
});

describe('session restoration', () => {
  it('revalidates a stored session against the server', async () => {
    renderWithProviders(<App />, { route: '/dashboard', user: citizen });

    expect(await screen.findByText(/welcome, rahul patel/i)).toBeInTheDocument();
    expect(authApi.me).toHaveBeenCalledTimes(1);
  });

  it('does not call the server when there is no stored token', async () => {
    renderWithProviders(<App />, { route: '/login' });

    expect(
      await screen.findByRole('heading', { name: /sign in/i })
    ).toBeInTheDocument();
    expect(authApi.me).not.toHaveBeenCalled();
  });

  it('signs the user out when the stored token is rejected', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired-token');
    localStorage.setItem(USER_KEY, JSON.stringify(citizen));
    authApi.me.mockRejectedValue(
      new ApiError('Session expired, please sign in again', { status: 401 })
    );

    renderWithProviders(<App />, { route: '/dashboard' });

    expect(
      await screen.findByRole('heading', { name: /sign in/i })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem(USER_KEY)).toBeNull();
    });
  });

  it('keeps the cached session when the server is unreachable', async () => {
    localStorage.setItem(TOKEN_KEY, 'valid-token');
    localStorage.setItem(USER_KEY, JSON.stringify(citizen));
    authApi.me.mockRejectedValue(
      new ApiError('Cannot reach the server. Check your connection.', {
        isNetworkError: true,
      })
    );

    renderWithProviders(<App />, { route: '/dashboard' });

    // A network blip must not log a citizen out mid-session.
    expect(await screen.findByText(/welcome, rahul patel/i)).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBe('valid-token');
  });

  it('adopts a role changed on the server since the last visit', async () => {
    localStorage.setItem(TOKEN_KEY, 'valid-token');
    localStorage.setItem(USER_KEY, JSON.stringify(citizen));
    // The same account has since been promoted to a verification officer.
    authApi.me.mockResolvedValue({
      data: { user: { ...citizen, role: 'VERIFICATION_OFFICER' } },
    });

    renderWithProviders(<App />, { route: '/officer' });

    expect(
      await screen.findByRole('heading', { name: /verification dashboard/i })
    ).toBeInTheDocument();
  });

  it('persists the refreshed profile for the next load', async () => {
    localStorage.setItem(TOKEN_KEY, 'valid-token');
    localStorage.setItem(USER_KEY, JSON.stringify(citizen));
    authApi.me.mockResolvedValue({
      data: { user: { ...citizen, name: 'Rahul M Patel' } },
    });

    renderWithProviders(<App />, { route: '/dashboard' });

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(USER_KEY)).name).toBe('Rahul M Patel');
    });
  });

  it('does not revalidate again after an explicit login', async () => {
    authApi.login.mockResolvedValue({
      data: { user: officer, token: 'fresh-token' },
    });

    renderWithProviders(<App />, { route: '/login' });

    // No stored token on this load, so no restore call was made.
    expect(authApi.me).not.toHaveBeenCalled();
  });
});
