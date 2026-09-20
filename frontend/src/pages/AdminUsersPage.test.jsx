import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../App';
import { ApiError } from '../services/apiClient';
import * as userApi from '../services/user.service';
import {
  renderWithProviders,
  admin,
  citizen,
  officer,
} from '../test/renderWithProviders';

vi.mock('../services/auth.service');
vi.mock('../services/user.service');

beforeEach(() => {
  vi.resetAllMocks();
});

function mockDirectory(users) {
  userApi.listUsers.mockResolvedValue({
    data: {
      users,
      pagination: { page: 1, pageSize: 25, total: users.length, totalPages: 1 },
    },
  });
}

describe('AdminUsersPage', () => {
  it('lists users for an administrator', async () => {
    mockDirectory([admin, citizen, officer]);
    renderWithProviders(<App />, { route: '/admin/users', user: admin });

    expect(
      await screen.findByRole('heading', { name: /user management/i })
    ).toBeInTheDocument();

    // The table renders after the directory request resolves.
    expect(await screen.findByText('rahul@example.com')).toBeInTheDocument();
    expect(screen.getByText('officer@example.gov')).toBeInTheDocument();
  });

  it('keeps a citizen out of user management', async () => {
    renderWithProviders(<App />, { route: '/admin/users', user: citizen });

    expect(await screen.findByText(/welcome, rahul patel/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /user management/i })
    ).not.toBeInTheDocument();
    expect(userApi.listUsers).not.toHaveBeenCalled();
  });

  it('keeps a verification officer out of user management', async () => {
    renderWithProviders(<App />, { route: '/admin/users', user: officer });

    expect(
      await screen.findByRole('heading', { name: /verification dashboard/i })
    ).toBeInTheDocument();
    expect(userApi.listUsers).not.toHaveBeenCalled();
  });

  it('shows the Users link only for an administrator', async () => {
    mockDirectory([admin]);
    const { unmount } = renderWithProviders(<App />, {
      route: '/admin/users',
      user: admin,
    });
    expect(await screen.findByRole('link', { name: /users/i })).toBeInTheDocument();
    unmount();

    renderWithProviders(<App />, { route: '/officer', user: officer });
    await screen.findByRole('heading', { name: /verification dashboard/i });
    expect(screen.queryByRole('link', { name: /^users$/i })).not.toBeInTheDocument();
  });

  it('promotes a citizen to verification officer', async () => {
    const user = userEvent.setup();
    mockDirectory([admin, citizen]);
    userApi.updateUserRole.mockResolvedValue({
      data: {
        previousRole: 'CITIZEN',
        user: { ...citizen, role: 'VERIFICATION_OFFICER' },
      },
    });

    renderWithProviders(<App />, { route: '/admin/users', user: admin });

    const select = await screen.findByLabelText(/role for rahul patel/i);
    await user.selectOptions(select, 'VERIFICATION_OFFICER');

    await waitFor(() => {
      expect(userApi.updateUserRole).toHaveBeenCalledWith(
        citizen.id,
        'VERIFICATION_OFFICER'
      );
    });

    expect(
      await screen.findByText(/rahul patel is now a verification officer/i)
    ).toBeInTheDocument();
  });

  it('stops an administrator from changing their own role', async () => {
    mockDirectory([admin, citizen]);
    renderWithProviders(<App />, { route: '/admin/users', user: admin });

    // Scope to the table: the header also shows the signed-in user's name.
    const table = await screen.findByRole('table');
    const ownRow = within(table)
      .getByText(/system administrator/i)
      .closest('tr');

    expect(within(ownRow).getByRole('combobox')).toBeDisabled();
    expect(within(ownRow).getByText('you')).toBeInTheDocument();
  });

  it('surfaces a rejected role change', async () => {
    const user = userEvent.setup();
    mockDirectory([admin, citizen]);
    userApi.updateUserRole.mockRejectedValue(
      new ApiError('You cannot change your own role', { status: 400 })
    );

    renderWithProviders(<App />, { route: '/admin/users', user: admin });

    const select = await screen.findByLabelText(/role for rahul patel/i);
    await user.selectOptions(select, 'ADMIN');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /cannot change your own role/i
    );
  });

  it('filters the directory by role', async () => {
    const user = userEvent.setup();
    mockDirectory([admin, citizen, officer]);

    renderWithProviders(<App />, { route: '/admin/users', user: admin });
    await screen.findByRole('heading', { name: /user management/i });

    mockDirectory([citizen]);
    await user.selectOptions(screen.getByLabelText(/filter by role/i), 'CITIZEN');

    await waitFor(() => {
      expect(userApi.listUsers).toHaveBeenLastCalledWith({ role: 'CITIZEN' });
    });
  });

  it('reports a failure to load the directory', async () => {
    userApi.listUsers.mockRejectedValue(
      new ApiError('Cannot reach the server. Check your connection.', {
        isNetworkError: true,
      })
    );

    renderWithProviders(<App />, { route: '/admin/users', user: admin });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /cannot reach the server/i
    );
  });

  it('handles an empty directory', async () => {
    mockDirectory([]);
    renderWithProviders(<App />, { route: '/admin/users', user: admin });

    expect(
      await screen.findByText(/no users match this filter/i)
    ).toBeInTheDocument();
  });
});
