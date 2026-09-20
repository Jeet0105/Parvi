import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../App';
import { ApiError } from '../services/apiClient';
import * as familyApi from '../services/family.service';
import * as verificationApi from '../services/verification.service';
import { renderWithProviders, citizen } from '../test/renderWithProviders';

vi.mock('../services/auth.service');
vi.mock('../services/family.service');
vi.mock('../services/verification.service');

beforeEach(() => {
  vi.resetAllMocks();
});

const family = {
  id: 'family-1',
  familyId: 'GJ-FAM-8A72K91X',
  status: 'DRAFT',
  district: 'Ahmedabad',
  taluka: 'Daskroi',
  village: 'Example Village',
  address: '12 Example Road',
  annualIncome: '120000',
  ownsHouse: false,
  createdAt: '2026-09-20T00:00:00.000Z',
  familyHeadId: 'member-1',
  familyHead: { id: 'member-1', name: 'Rahul Patel' },
  members: [
    {
      id: 'member-1',
      name: 'Rahul Patel',
      dateOfBirth: '1985-04-12T00:00:00.000Z',
      gender: 'MALE',
      verificationStatus: 'PENDING',
      status: 'ACTIVE',
    },
    {
      id: 'member-2',
      name: 'Priya Patel',
      dateOfBirth: '1988-05-12T00:00:00.000Z',
      gender: 'FEMALE',
      verificationStatus: 'VERIFIED',
      status: 'ACTIVE',
    },
  ],
};

describe('FamilyDetailPage', () => {
  it('shows the Family ID and summary', async () => {
    familyApi.getMyFamily.mockResolvedValue({ data: { family } });
    renderWithProviders(<App />, { route: '/family', user: citizen });

    expect(await screen.findByText('GJ-FAM-8A72K91X')).toBeInTheDocument();
    expect(screen.getByText('Ahmedabad')).toBeInTheDocument();
    expect(screen.getByText('Daskroi')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('lists every member with their verification status', async () => {
    familyApi.getMyFamily.mockResolvedValue({ data: { family } });
    renderWithProviders(<App />, { route: '/family', user: citizen });

    // "Rahul Patel" also appears in the header, so wait on a row that only
    // exists once the family data has loaded.
    expect(await screen.findByText('Priya Patel')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('marks which member is the Family Head', async () => {
    familyApi.getMyFamily.mockResolvedValue({ data: { family } });
    renderWithProviders(<App />, { route: '/family', user: citizen });

    expect(await screen.findByText('Head')).toBeInTheDocument();
  });

  it('computes each member age from their date of birth', async () => {
    familyApi.getMyFamily.mockResolvedValue({ data: { family } });
    renderWithProviders(<App />, { route: '/family', user: citizen });

    const table = await screen.findByRole('table');
    const row = within(table).getByText('Rahul Patel').closest('tr');
    // Born 1985-04-12; today is in 2026.
    expect(row).toHaveTextContent('41');
  });

  it('formats the household income as currency', async () => {
    familyApi.getMyFamily.mockResolvedValue({ data: { family } });
    renderWithProviders(<App />, { route: '/family', user: citizen });

    expect(await screen.findByText(/1,20,000/)).toBeInTheDocument();
  });

  it('prompts registration when no family exists', async () => {
    familyApi.getMyFamily.mockResolvedValue({ data: { family: null } });
    renderWithProviders(<App />, { route: '/family', user: citizen });

    expect(
      await screen.findByText(/you have not registered a family yet/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /register your family/i })
    ).toBeInTheDocument();
  });

  it('navigates from the empty state to the registration form', async () => {
    const user = userEvent.setup();
    familyApi.getMyFamily.mockResolvedValue({ data: { family: null } });
    renderWithProviders(<App />, { route: '/family', user: citizen });

    await user.click(
      await screen.findByRole('link', { name: /register your family/i })
    );

    expect(
      await screen.findByRole('heading', { name: /register your family/i })
    ).toBeInTheDocument();
  });

  it('reports a failure to load', async () => {
    familyApi.getMyFamily.mockRejectedValue(
      new ApiError('Cannot reach the server. Check your connection.', {
        isNetworkError: true,
      })
    );
    renderWithProviders(<App />, { route: '/family', user: citizen });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /cannot reach the server/i
    );
  });

  it('handles a family with no extra members', async () => {
    familyApi.getMyFamily.mockResolvedValue({
      data: { family: { ...family, members: [family.members[0]] } },
    });
    renderWithProviders(<App />, { route: '/family', user: citizen });

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Rahul Patel')).toBeInTheDocument();
    expect(screen.queryByText('Priya Patel')).not.toBeInTheDocument();
  });
});

describe('CitizenDashboardPage family summary', () => {
  it('shows the Family ID once registered', async () => {
    familyApi.getMyFamily.mockResolvedValue({ data: { family } });
    renderWithProviders(<App />, { route: '/dashboard', user: citizen });

    expect(await screen.findByText('GJ-FAM-8A72K91X')).toBeInTheDocument();
    expect(screen.getByText(/2 members/i)).toBeInTheDocument();
  });

  it('pluralises a single member correctly', async () => {
    familyApi.getMyFamily.mockResolvedValue({
      data: { family: { ...family, members: [family.members[0]] } },
    });
    renderWithProviders(<App />, { route: '/dashboard', user: citizen });

    expect(await screen.findByText(/1 member ·/i)).toBeInTheDocument();
  });

  it('prompts registration when there is no family', async () => {
    familyApi.getMyFamily.mockResolvedValue({ data: { family: null } });
    renderWithProviders(<App />, { route: '/dashboard', user: citizen });

    expect(
      await screen.findByText(/registration takes a minute/i)
    ).toBeInTheDocument();
  });
});

describe('FamilyDetailPage — submitting for verification', () => {
  it('offers submission while the family is a draft', async () => {
    familyApi.getMyFamily.mockResolvedValue({ data: { family } });
    renderWithProviders(<App />, { route: '/family', user: citizen });

    expect(
      await screen.findByRole('button', { name: /submit for verification/i })
    ).toBeInTheDocument();
  });

  it('submits the family', async () => {
    const user = userEvent.setup();
    familyApi.getMyFamily.mockResolvedValue({ data: { family } });
    verificationApi.submitFamily.mockResolvedValue({
      data: { family: { ...family, status: 'PENDING_VERIFICATION' } },
    });

    renderWithProviders(<App />, { route: '/family', user: citizen });
    await user.click(
      await screen.findByRole('button', { name: /submit for verification/i })
    );

    await waitFor(() => {
      expect(verificationApi.submitFamily).toHaveBeenCalledWith('family-1');
    });
    expect(
      await screen.findByText(/submitted for verification/i)
    ).toBeInTheDocument();
  });

  it('explains a submission with no documents', async () => {
    const user = userEvent.setup();
    familyApi.getMyFamily.mockResolvedValue({ data: { family } });
    verificationApi.submitFamily.mockRejectedValue(
      new ApiError('Upload at least one supporting document first', {
        status: 422,
        errors: [
          { field: 'documents', message: 'No documents have been uploaded' },
        ],
      })
    );

    renderWithProviders(<App />, { route: '/family', user: citizen });
    await user.click(
      await screen.findByRole('button', { name: /submit for verification/i })
    );

    expect(
      await screen.findByText(/no documents have been uploaded/i)
    ).toBeInTheDocument();
    // The family record stays on screen rather than being replaced by the error.
    expect(screen.getByText('GJ-FAM-8A72K91X')).toBeInTheDocument();
  });

  it('hides submission while awaiting an officer', async () => {
    familyApi.getMyFamily.mockResolvedValue({
      data: { family: { ...family, status: 'PENDING_VERIFICATION' } },
    });
    renderWithProviders(<App />, { route: '/family', user: citizen });

    expect(
      await screen.findByText(/with a verification officer/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /submit for verification/i })
    ).not.toBeInTheDocument();
  });

  it('shows why a family was returned, and offers resubmission', async () => {
    familyApi.getMyFamily.mockResolvedValue({
      data: {
        family: {
          ...family,
          status: 'REJECTED',
          rejectionReason: 'Address proof is missing',
        },
      },
    });
    renderWithProviders(<App />, { route: '/family', user: citizen });

    expect(
      await screen.findByText(/address proof is missing/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /submit for verification/i })
    ).toBeInTheDocument();
  });

  it('hides submission once verified', async () => {
    familyApi.getMyFamily.mockResolvedValue({
      data: { family: { ...family, status: 'VERIFIED' } },
    });
    renderWithProviders(<App />, { route: '/family', user: citizen });

    await screen.findByText('GJ-FAM-8A72K91X');
    expect(
      screen.queryByRole('button', { name: /submit for verification/i })
    ).not.toBeInTheDocument();
  });
});
