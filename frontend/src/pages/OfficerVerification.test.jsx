import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../App';
import { ApiError } from '../services/apiClient';
import * as familyApi from '../services/family.service';
import * as verificationApi from '../services/verification.service';
import {
  renderWithProviders,
  citizen,
  officer,
  admin,
} from '../test/renderWithProviders';

vi.mock('../services/auth.service');
vi.mock('../services/family.service');
vi.mock('../services/verification.service');

beforeEach(() => {
  vi.resetAllMocks();
});

const districtOfficer = {
  id: 'user-4',
  name: 'District Officer',
  email: 'district@example.gov',
  mobile: '9876500002',
  role: 'DISTRICT_OFFICER',
};

const stats = {
  scope: 'All districts',
  pendingFamilies: 2,
  pendingMembers: 5,
  pendingRelationships: 3,
  pendingDocuments: 4,
  verifiedFamilies: 7,
  totalFamilies: 9,
};

const head = {
  id: 'member-1',
  name: 'Rahul Patel',
  dateOfBirth: '1985-04-12T00:00:00.000Z',
  status: 'ACTIVE',
  verificationStatus: 'PENDING',
};

const child = {
  id: 'member-2',
  name: 'Riya Patel',
  dateOfBirth: '2012-03-08T00:00:00.000Z',
  status: 'ACTIVE',
  verificationStatus: 'VERIFIED',
};

const queuedFamily = {
  id: 'family-1',
  familyId: 'GJ-FAM-8A72K91X',
  status: 'PENDING_VERIFICATION',
  district: 'Ahmedabad',
  village: 'Example Village',
  updatedAt: '2026-09-18T00:00:00.000Z',
  familyHeadId: 'member-1',
  familyHead: head,
  members: [head, child],
  _count: { members: 2, relationships: 1 },
};

function mockQueue(families = [queuedFamily]) {
  verificationApi.listPendingFamilies.mockResolvedValue({
    data: {
      families,
      pagination: {
        page: 1,
        pageSize: 25,
        total: families.length,
        totalPages: 1,
      },
    },
  });
}

describe('OfficerDashboardPage', () => {
  it('shows every pending count', async () => {
    verificationApi.getStatistics.mockResolvedValue({ data: stats });
    renderWithProviders(<App />, { route: '/officer', user: officer });

    await screen.findByText(/awaiting a decision/i);
    // The nav also has Families and Documents links, so scope to the page.
    const main = within(screen.getByRole('main'));
    expect(main.getByText('Families').closest('a')).toHaveTextContent('2');
    expect(main.getByText('Relationships').closest('a')).toHaveTextContent('3');
    expect(main.getByText('Documents').closest('a')).toHaveTextContent('4');
  });

  it('shows the scope a district officer is limited to', async () => {
    verificationApi.getStatistics.mockResolvedValue({
      data: { ...stats, scope: 'Surat' },
    });
    renderWithProviders(<App />, { route: '/officer', user: districtOfficer });

    expect(
      await screen.findByText(/district officer . surat/i)
    ).toBeInTheDocument();
  });

  it('links each count to its queue', async () => {
    verificationApi.getStatistics.mockResolvedValue({ data: stats });
    renderWithProviders(<App />, { route: '/officer', user: officer });

    await screen.findByText(/awaiting a decision/i);
    const main = within(screen.getByRole('main'));
    expect(main.getByText('Documents').closest('a')).toHaveAttribute(
      'href',
      '/officer/documents'
    );
  });

  it('says so when every queue is clear', async () => {
    verificationApi.getStatistics.mockResolvedValue({
      data: {
        ...stats,
        pendingFamilies: 0,
        pendingRelationships: 0,
        pendingDocuments: 0,
      },
    });
    renderWithProviders(<App />, { route: '/officer', user: officer });

    expect(await screen.findByText(/every queue is clear/i)).toBeInTheDocument();
  });

  it('reports a failure to load statistics', async () => {
    verificationApi.getStatistics.mockRejectedValue(
      new ApiError('Cannot reach the server. Check your connection.', {
        isNetworkError: true,
      })
    );
    renderWithProviders(<App />, { route: '/officer', user: officer });

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach/i);
  });
});

describe('FamilyQueuePage', () => {
  it('lists submitted families', async () => {
    mockQueue();
    renderWithProviders(<App />, { route: '/officer/families', user: officer });

    expect(await screen.findByText('GJ-FAM-8A72K91X')).toBeInTheDocument();
    expect(screen.getByText(/head: rahul patel/i)).toBeInTheDocument();
  });

  it('shows how many members still need verifying', async () => {
    mockQueue();
    renderWithProviders(<App />, { route: '/officer/families', user: officer });

    expect(
      await screen.findByRole('button', { name: /review members \(1\)/i })
    ).toBeInTheDocument();
  });

  it('expands to show each member', async () => {
    const user = userEvent.setup();
    mockQueue();
    renderWithProviders(<App />, { route: '/officer/families', user: officer });

    await user.click(
      await screen.findByRole('button', { name: /review members/i })
    );

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Rahul Patel')).toBeInTheDocument();
    expect(within(table).getByText('Riya Patel')).toBeInTheDocument();
  });

  it('verifies an individual member', async () => {
    const user = userEvent.setup();
    mockQueue();
    verificationApi.verifyMember.mockResolvedValue({
      data: { member: { ...head, verificationStatus: 'VERIFIED' } },
    });

    renderWithProviders(<App />, { route: '/officer/families', user: officer });
    await user.click(
      await screen.findByRole('button', { name: /review members/i })
    );

    const table = await screen.findByRole('table');
    const row = within(table).getByText('Rahul Patel').closest('tr');
    await user.click(within(row).getByRole('button', { name: /verify/i }));

    await waitFor(() => {
      expect(verificationApi.verifyMember).toHaveBeenCalledWith('member-1', {
        action: 'APPROVE',
      });
    });
    expect(
      await screen.findByText(/rahul patel marked verified/i)
    ).toBeInTheDocument();
  });

  it('disables verify on an already verified member', async () => {
    const user = userEvent.setup();
    mockQueue();
    renderWithProviders(<App />, { route: '/officer/families', user: officer });

    await user.click(
      await screen.findByRole('button', { name: /review members/i })
    );
    const table = await screen.findByRole('table');
    const row = within(table).getByText('Riya Patel').closest('tr');

    expect(within(row).getByRole('button', { name: /verify/i })).toBeDisabled();
  });

  it('surfaces the refusal to verify a family with unverified members', async () => {
    const user = userEvent.setup();
    mockQueue();
    verificationApi.verifyFamily.mockRejectedValue(
      new ApiError('Verify all 1 remaining member before verifying the family', {
        status: 409,
      })
    );

    renderWithProviders(<App />, { route: '/officer/families', user: officer });
    await screen.findByText('GJ-FAM-8A72K91X');
    await user.click(screen.getByRole('button', { name: /verify family/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /remaining member/i
    );
    // The family stays in the queue because nothing changed.
    expect(screen.getByText('GJ-FAM-8A72K91X')).toBeInTheDocument();
  });

  it('verifies a family and drops it from the queue', async () => {
    const user = userEvent.setup();
    mockQueue();
    verificationApi.verifyFamily.mockResolvedValue({
      data: { family: { ...queuedFamily, status: 'VERIFIED' } },
    });

    renderWithProviders(<App />, { route: '/officer/families', user: officer });
    await screen.findByText('GJ-FAM-8A72K91X');
    await user.click(screen.getByRole('button', { name: /verify family/i }));

    expect(
      await screen.findByText(/GJ-FAM-8A72K91X is now verified/i)
    ).toBeInTheDocument();
  });

  it('requires a reason to reject a family', async () => {
    const user = userEvent.setup();
    mockQueue();

    renderWithProviders(<App />, { route: '/officer/families', user: officer });
    await screen.findByText('GJ-FAM-8A72K91X');
    await user.click(screen.getByRole('button', { name: /^reject$/i }));

    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: /reject family/i })
    );

    expect(await screen.findByText(/give a reason/i)).toBeInTheDocument();
    expect(verificationApi.verifyFamily).not.toHaveBeenCalled();
  });

  it('rejects a family with a reason', async () => {
    const user = userEvent.setup();
    mockQueue();
    verificationApi.verifyFamily.mockResolvedValue({
      data: { family: { ...queuedFamily, status: 'REJECTED' } },
    });

    renderWithProviders(<App />, { route: '/officer/families', user: officer });
    await screen.findByText('GJ-FAM-8A72K91X');
    await user.click(screen.getByRole('button', { name: /^reject$/i }));

    const dialog = await screen.findByRole('dialog');
    await user.type(
      within(dialog).getByLabelText(/reason/i),
      'Address proof missing'
    );
    await user.click(
      within(dialog).getByRole('button', { name: /reject family/i })
    );

    await waitFor(() => {
      expect(verificationApi.verifyFamily).toHaveBeenCalledWith('family-1', {
        action: 'REJECT',
        reason: 'Address proof missing',
      });
    });
  });

  it('lets an admin decide', async () => {
    mockQueue();
    renderWithProviders(<App />, { route: '/officer/families', user: admin });

    await screen.findByText('GJ-FAM-8A72K91X');
    expect(
      screen.getByRole('button', { name: /verify family/i })
    ).toBeEnabled();
  });

  it('shows a district officer the queue without decision controls', async () => {
    mockQueue();
    renderWithProviders(<App />, {
      route: '/officer/families',
      user: districtOfficer,
    });

    await screen.findByText('GJ-FAM-8A72K91X');
    expect(
      screen.getByText(/can review this queue but not decide/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /verify family/i })
    ).toBeDisabled();
  });

  it('keeps a citizen out', async () => {
    familyApi.getMyFamily.mockResolvedValue({ data: { family: null } });
    renderWithProviders(<App />, { route: '/officer/families', user: citizen });

    expect(await screen.findByText(/welcome, rahul patel/i)).toBeInTheDocument();
    expect(verificationApi.listPendingFamilies).not.toHaveBeenCalled();
  });

  it('shows an empty queue clearly', async () => {
    mockQueue([]);
    renderWithProviders(<App />, { route: '/officer/families', user: officer });

    expect(
      await screen.findByText(/no families are waiting for verification/i)
    ).toBeInTheDocument();
  });
});
