import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../App';
import { ApiError } from '../services/apiClient';
import * as familyApi from '../services/family.service';
import * as relationshipApi from '../services/relationship.service';
import {
  renderWithProviders,
  citizen,
  officer,
  admin,
} from '../test/renderWithProviders';

vi.mock('../services/auth.service');
vi.mock('../services/family.service');
vi.mock('../services/member.service');
vi.mock('../services/relationship.service');

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

const pendingItem = {
  id: 'rel-1',
  relationshipType: 'FATHER',
  verificationStatus: 'PENDING',
  createdAt: '2026-09-18T00:00:00.000Z',
  rejectionReason: null,
  fromMember: { id: 'member-1', name: 'Rahul Patel' },
  toMember: { id: 'member-3', name: 'Riya Patel' },
  family: { id: 'family-1', familyId: 'GJ-FAM-8A72K91X', district: 'Ahmedabad' },
};

function mockQueue(relationships = [pendingItem]) {
  relationshipApi.listPending.mockResolvedValue({
    data: {
      relationships,
      pagination: {
        page: 1,
        pageSize: 25,
        total: relationships.length,
        totalPages: 1,
      },
    },
  });
}

describe('VerificationQueuePage — listing', () => {
  it('shows pending relationships in plain language', async () => {
    mockQueue();
    renderWithProviders(<App />, { route: '/officer/relationships', user: officer });

    expect(await screen.findByText('GJ-FAM-8A72K91X')).toBeInTheDocument();
    const row = screen.getByText('GJ-FAM-8A72K91X').closest('tr');
    expect(row).toHaveTextContent('Rahul Patel is the father of Riya Patel');
  });

  it('reports how many decisions are waiting', async () => {
    mockQueue();
    renderWithProviders(<App />, { route: '/officer/relationships', user: officer });

    expect(
      await screen.findByText(/1 relationship awaiting a decision/i)
    ).toBeInTheDocument();
  });

  it('shows an empty queue clearly', async () => {
    mockQueue([]);
    renderWithProviders(<App />, { route: '/officer/relationships', user: officer });

    expect(
      await screen.findByText(/nothing is waiting for verification/i)
    ).toBeInTheDocument();
  });

  it('keeps a citizen out of the queue', async () => {
    // The citizen is bounced to their dashboard, which loads their family.
    familyApi.getMyFamily.mockResolvedValue({ data: { family: null } });
    renderWithProviders(<App />, { route: '/officer/relationships', user: citizen });

    expect(await screen.findByText(/welcome, rahul patel/i)).toBeInTheDocument();
    expect(relationshipApi.listPending).not.toHaveBeenCalled();
  });

  it('reports a failure to load', async () => {
    relationshipApi.listPending.mockRejectedValue(
      new ApiError('Cannot reach the server. Check your connection.', {
        isNetworkError: true,
      })
    );
    renderWithProviders(<App />, { route: '/officer/relationships', user: officer });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /cannot reach the server/i
    );
  });
});

describe('VerificationQueuePage — decisions', () => {
  it('approves a relationship and drops it from the queue', async () => {
    const user = userEvent.setup();
    mockQueue();
    relationshipApi.verifyRelationship.mockResolvedValue({
      data: { relationship: { ...pendingItem, verificationStatus: 'VERIFIED' } },
    });

    renderWithProviders(<App />, { route: '/officer/relationships', user: officer });
    await screen.findByText('GJ-FAM-8A72K91X');

    await user.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => {
      expect(relationshipApi.verifyRelationship).toHaveBeenCalledWith('rel-1', {
        action: 'APPROVE',
      });
    });
    expect(
      await screen.findByText(/verified: rahul patel is the father of riya patel/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('GJ-FAM-8A72K91X')).not.toBeInTheDocument();
  });

  it('requires a reason before rejecting', async () => {
    const user = userEvent.setup();
    mockQueue();

    renderWithProviders(<App />, { route: '/officer/relationships', user: officer });
    await screen.findByText('GJ-FAM-8A72K91X');

    await user.click(screen.getByRole('button', { name: /^reject$/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: /reject relationship/i })
    );

    expect(await screen.findByText(/give a reason/i)).toBeInTheDocument();
    // Nothing was sent without a reason.
    expect(relationshipApi.verifyRelationship).not.toHaveBeenCalled();
  });

  it('rejects with a reason', async () => {
    const user = userEvent.setup();
    mockQueue();
    relationshipApi.verifyRelationship.mockResolvedValue({
      data: { relationship: { ...pendingItem, verificationStatus: 'REJECTED' } },
    });

    renderWithProviders(<App />, { route: '/officer/relationships', user: officer });
    await screen.findByText('GJ-FAM-8A72K91X');

    await user.click(screen.getByRole('button', { name: /^reject$/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(
      within(dialog).getByLabelText(/reason/i),
      'Birth certificate does not match'
    );
    await user.click(
      within(dialog).getByRole('button', { name: /reject relationship/i })
    );

    await waitFor(() => {
      expect(relationshipApi.verifyRelationship).toHaveBeenCalledWith('rel-1', {
        action: 'REJECT',
        reason: 'Birth certificate does not match',
      });
    });
    expect(screen.queryByText('GJ-FAM-8A72K91X')).not.toBeInTheDocument();
  });

  it('warns the officer that the family will read the reason', async () => {
    const user = userEvent.setup();
    mockQueue();

    renderWithProviders(<App />, { route: '/officer/relationships', user: officer });
    await screen.findByText('GJ-FAM-8A72K91X');
    await user.click(screen.getByRole('button', { name: /^reject$/i }));

    expect(
      await screen.findByText(/the family sees this/i)
    ).toBeInTheDocument();
  });

  it('surfaces a server refusal', async () => {
    const user = userEvent.setup();
    mockQueue();
    relationshipApi.verifyRelationship.mockRejectedValue(
      new ApiError('Relationship is already VERIFIED', { status: 409 })
    );

    renderWithProviders(<App />, { route: '/officer/relationships', user: officer });
    await screen.findByText('GJ-FAM-8A72K91X');
    await user.click(screen.getByRole('button', { name: /approve/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /already verified/i
    );
    // The row stays, because the decision did not go through.
    expect(screen.getByText('GJ-FAM-8A72K91X')).toBeInTheDocument();
  });

  it('lets an admin decide', async () => {
    const user = userEvent.setup();
    mockQueue();
    relationshipApi.verifyRelationship.mockResolvedValue({
      data: { relationship: { ...pendingItem, verificationStatus: 'VERIFIED' } },
    });

    renderWithProviders(<App />, { route: '/officer/relationships', user: admin });
    await screen.findByText('GJ-FAM-8A72K91X');
    await user.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => {
      expect(relationshipApi.verifyRelationship).toHaveBeenCalled();
    });
  });

  it('shows a district officer the queue without decision controls', async () => {
    mockQueue();
    renderWithProviders(<App />, {
      route: '/officer/relationships',
      user: districtOfficer,
    });

    await screen.findByText('GJ-FAM-8A72K91X');
    // District officers review and report; they do not verify.
    expect(
      screen.getByText(/can review this queue but not decide/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^reject$/i })).toBeDisabled();
  });
});
