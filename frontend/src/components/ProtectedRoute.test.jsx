import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../App';
import * as authApi from '../services/auth.service';
import { renderWithProviders, citizen, officer } from '../test/renderWithProviders';

vi.mock('../services/auth.service');

beforeEach(() => {
  vi.resetAllMocks();
});

describe('route protection', () => {
  it('redirects an anonymous visitor to login', async () => {
    renderWithProviders(<App />, { route: '/dashboard' });

    expect(
      await screen.findByRole('heading', { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it('redirects the root path to login when signed out', async () => {
    renderWithProviders(<App />, { route: '/' });

    expect(
      await screen.findByRole('heading', { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it('lets a signed-in citizen reach the dashboard', async () => {
    renderWithProviders(<App />, { route: '/dashboard', user: citizen });

    expect(await screen.findByText(/welcome, rahul patel/i)).toBeInTheDocument();
  });

  it('restores a session from storage on a fresh load', async () => {
    renderWithProviders(<App />, { route: '/', user: citizen });

    expect(await screen.findByText(/welcome, rahul patel/i)).toBeInTheDocument();
  });

  it('keeps a citizen out of the officer area', async () => {
    renderWithProviders(<App />, { route: '/officer', user: citizen });

    // Bounced back to their own dashboard.
    expect(await screen.findByText(/welcome, rahul patel/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /verification dashboard/i })
    ).not.toBeInTheDocument();
  });

  it('keeps an officer out of the citizen dashboard', async () => {
    renderWithProviders(<App />, { route: '/dashboard', user: officer });

    expect(
      await screen.findByRole('heading', { name: /verification dashboard/i })
    ).toBeInTheDocument();
  });

  it('returns a signed-in user to the page they originally wanted', async () => {
    const user = userEvent.setup();
    authApi.login.mockResolvedValue({
      data: { user: officer, token: 'jwt-token' },
    });

    // Anonymous visit to a protected officer route bounces to login...
    renderWithProviders(<App />, { route: '/officer' });
    expect(
      await screen.findByRole('heading', { name: /sign in/i })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email/i), 'officer@example.gov');
    await user.type(screen.getByLabelText(/password/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // ...and after signing in they land where they were headed.
    expect(
      await screen.findByRole('heading', { name: /verification dashboard/i })
    ).toBeInTheDocument();
  });

  it('shows a 404 page for an unknown route', async () => {
    renderWithProviders(<App />, { route: '/nope', user: citizen });

    expect(
      await screen.findByRole('heading', { name: /page not found/i })
    ).toBeInTheDocument();
  });

  it('signs the user out and clears the stored session', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/dashboard', user: citizen });

    expect(await screen.findByText(/welcome, rahul patel/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(
      await screen.findByRole('heading', { name: /sign in/i })
    ).toBeInTheDocument();
    expect(localStorage.getItem('fip.token')).toBeNull();
    expect(localStorage.getItem('fip.user')).toBeNull();
  });

  it('shows the signed-in identity and role in the header', async () => {
    renderWithProviders(<App />, { route: '/officer', user: officer });

    expect(await screen.findByText('Officer Mehta')).toBeInTheDocument();
    expect(screen.getByText('Verification Officer')).toBeInTheDocument();
  });
});
