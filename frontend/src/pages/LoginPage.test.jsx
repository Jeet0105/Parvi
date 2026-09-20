import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../App';
import { ApiError, TOKEN_KEY } from '../services/apiClient';
import * as authApi from '../services/auth.service';
import { renderWithProviders, citizen, officer } from '../test/renderWithProviders';

vi.mock('../services/auth.service');

beforeEach(() => {
  vi.resetAllMocks();
});

async function fillAndSubmit(user, { email, password }) {
  await user.type(screen.getByLabelText(/email/i), email);
  await user.type(screen.getByLabelText(/password/i), password);
  await user.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('LoginPage', () => {
  it('renders the sign-in form', () => {
    renderWithProviders(<App />, { route: '/login' });

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('sends credentials and lands a citizen on their dashboard', async () => {
    const user = userEvent.setup();
    authApi.login.mockResolvedValue({
      data: { user: citizen, token: 'jwt-token' },
    });

    renderWithProviders(<App />, { route: '/login' });
    await fillAndSubmit(user, {
      email: 'rahul@example.com',
      password: 'Password123',
    });

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: 'rahul@example.com',
        password: 'Password123',
      });
    });

    expect(await screen.findByText(/welcome, rahul patel/i)).toBeInTheDocument();
  });

  it('stores the token so the session survives a reload', async () => {
    const user = userEvent.setup();
    authApi.login.mockResolvedValue({
      data: { user: citizen, token: 'jwt-token' },
    });

    renderWithProviders(<App />, { route: '/login' });
    await fillAndSubmit(user, {
      email: 'rahul@example.com',
      password: 'Password123',
    });

    await waitFor(() => {
      expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt-token');
    });
  });

  it('routes an officer to the verification dashboard', async () => {
    const user = userEvent.setup();
    authApi.login.mockResolvedValue({
      data: { user: officer, token: 'jwt-token' },
    });

    renderWithProviders(<App />, { route: '/login' });
    await fillAndSubmit(user, {
      email: 'officer@example.gov',
      password: 'Password123',
    });

    expect(
      await screen.findByRole('heading', { name: /verification dashboard/i })
    ).toBeInTheDocument();
  });

  it('shows the API message when credentials are rejected', async () => {
    const user = userEvent.setup();
    authApi.login.mockRejectedValue(
      new ApiError('Invalid email or password', { status: 401 })
    );

    renderWithProviders(<App />, { route: '/login' });
    await fillAndSubmit(user, {
      email: 'rahul@example.com',
      password: 'WrongPassword1',
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /invalid email or password/i
    );
    // Still on the login page.
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows per-field messages for a validation failure', async () => {
    const user = userEvent.setup();
    authApi.login.mockRejectedValue(
      new ApiError('Validation failed', {
        status: 422,
        errors: [{ field: 'email', message: 'Invalid email address' }],
      })
    );

    renderWithProviders(<App />, { route: '/login' });
    await fillAndSubmit(user, { email: 'bad', password: 'x' });

    expect(await screen.findByText(/invalid email address/i)).toBeInTheDocument();
  });

  it('reports an unreachable server', async () => {
    const user = userEvent.setup();
    authApi.login.mockRejectedValue(
      new ApiError('Cannot reach the server. Check your connection.', {
        isNetworkError: true,
      })
    );

    renderWithProviders(<App />, { route: '/login' });
    await fillAndSubmit(user, {
      email: 'rahul@example.com',
      password: 'Password123',
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /cannot reach the server/i
    );
  });

  it('disables the button while the request is in flight', async () => {
    const user = userEvent.setup();
    let resolve;
    authApi.login.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );

    renderWithProviders(<App />, { route: '/login' });
    await fillAndSubmit(user, {
      email: 'rahul@example.com',
      password: 'Password123',
    });

    const button = screen.getByRole('button', { name: /signing in/i });
    expect(button).toBeDisabled();

    resolve({ data: { user: citizen, token: 'jwt-token' } });
    await waitFor(() => expect(authApi.login).toHaveBeenCalledTimes(1));
  });

  it('clears a field error once the user edits that field', async () => {
    const user = userEvent.setup();
    authApi.login.mockRejectedValue(
      new ApiError('Validation failed', {
        status: 422,
        errors: [{ field: 'email', message: 'Invalid email address' }],
      })
    );

    renderWithProviders(<App />, { route: '/login' });
    await fillAndSubmit(user, { email: 'bad', password: 'x' });
    expect(await screen.findByText(/invalid email address/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email/i), 'more');

    await waitFor(() => {
      expect(screen.queryByText(/invalid email address/i)).not.toBeInTheDocument();
    });
  });

  it('links to the registration page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/login' });

    await user.click(screen.getByRole('link', { name: /register a family/i }));

    expect(
      await screen.findByRole('heading', { name: /create your account/i })
    ).toBeInTheDocument();
  });
});
