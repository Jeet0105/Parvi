import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../App';
import { ApiError } from '../services/apiClient';
import * as authApi from '../services/auth.service';
import { renderWithProviders, citizen } from '../test/renderWithProviders';

vi.mock('../services/auth.service');

beforeEach(() => {
  vi.resetAllMocks();
});

const validInput = {
  name: 'Rahul Patel',
  email: 'rahul@example.com',
  mobile: '9876543210',
  password: 'Password123',
};

async function fillForm(user, input = validInput) {
  await user.type(screen.getByLabelText(/full name/i), input.name);
  await user.type(screen.getByLabelText(/email/i), input.email);
  await user.type(screen.getByLabelText(/mobile number/i), input.mobile);
  await user.type(screen.getByLabelText(/password/i), input.password);
}

describe('RegisterPage', () => {
  it('renders every required field', () => {
    renderWithProviders(<App />, { route: '/register' });

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mobile number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('shows the password and mobile rules up front', () => {
    renderWithProviders(<App />, { route: '/register' });

    expect(screen.getByText(/10 digits, starting with 6 to 9/i)).toBeInTheDocument();
    expect(
      screen.getByText(/at least 8 characters, including a letter and a number/i)
    ).toBeInTheDocument();
  });

  it('submits the form and signs the new citizen in', async () => {
    const user = userEvent.setup();
    authApi.register.mockResolvedValue({
      data: { user: citizen, token: 'jwt-token' },
    });

    renderWithProviders(<App />, { route: '/register' });
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith(validInput);
    });

    expect(await screen.findByText(/welcome, rahul patel/i)).toBeInTheDocument();
  });

  it('shows inline errors for each rejected field', async () => {
    const user = userEvent.setup();
    authApi.register.mockRejectedValue(
      new ApiError('Validation failed', {
        status: 422,
        errors: [
          { field: 'mobile', message: 'Mobile must be a valid 10-digit number' },
          { field: 'password', message: 'Password must contain a number' },
        ],
      })
    );

    renderWithProviders(<App />, { route: '/register' });
    await fillForm(user, { ...validInput, mobile: '12345', password: 'abcdefgh' });
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(
      await screen.findByText(/mobile must be a valid 10-digit number/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/password must contain a number/i)
    ).toBeInTheDocument();
  });

  it('does not show a duplicate banner for field-level validation errors', async () => {
    const user = userEvent.setup();
    authApi.register.mockRejectedValue(
      new ApiError('Validation failed', {
        status: 422,
        errors: [{ field: 'email', message: 'Invalid email address' }],
      })
    );

    renderWithProviders(<App />, { route: '/register' });
    await fillForm(user, { ...validInput, email: 'bad' });
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/invalid email address/i)).toBeInTheDocument();
    // The generic "Validation failed" banner would be noise here.
    expect(screen.queryByText(/^validation failed$/i)).not.toBeInTheDocument();
  });

  it('shows a banner when the email is already registered', async () => {
    const user = userEvent.setup();
    authApi.register.mockRejectedValue(
      new ApiError('An account with this email already exists', {
        status: 409,
        errors: [{ field: 'email', message: 'Already registered' }],
      })
    );

    renderWithProviders(<App />, { route: '/register' });
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // Two alerts are intentional: a banner explaining the conflict, plus an
    // inline message pointing at the field that caused it.
    const alertText = (await screen.findAllByRole('alert')).map(
      (el) => el.textContent
    );
    expect(alertText).toEqual(
      expect.arrayContaining([
        'An account with this email already exists',
        'Already registered',
      ])
    );
  });

  it('marks invalid fields for assistive technology', async () => {
    const user = userEvent.setup();
    authApi.register.mockRejectedValue(
      new ApiError('Validation failed', {
        status: 422,
        errors: [{ field: 'email', message: 'Invalid email address' }],
      })
    );

    renderWithProviders(<App />, { route: '/register' });
    await fillForm(user, { ...validInput, email: 'bad' });
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('links back to sign in', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/register' });

    await user.click(screen.getByRole('link', { name: /sign in/i }));

    expect(
      await screen.findByRole('heading', { name: /sign in/i })
    ).toBeInTheDocument();
  });
});
