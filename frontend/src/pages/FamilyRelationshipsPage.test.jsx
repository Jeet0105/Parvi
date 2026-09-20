import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../App';
import { ApiError } from '../services/apiClient';
import * as familyApi from '../services/family.service';
import * as memberApi from '../services/member.service';
import * as relationshipApi from '../services/relationship.service';
import { renderWithProviders, citizen } from '../test/renderWithProviders';

vi.mock('../services/auth.service');
vi.mock('../services/family.service');
vi.mock('../services/member.service');
vi.mock('../services/relationship.service');

beforeEach(() => {
  vi.resetAllMocks();
});

const members = [
  { id: 'member-1', name: 'Rahul Patel', gender: 'MALE', status: 'ACTIVE' },
  { id: 'member-2', name: 'Priya Patel', gender: 'FEMALE', status: 'ACTIVE' },
  { id: 'member-3', name: 'Riya Patel', gender: 'FEMALE', status: 'ACTIVE' },
];

const family = {
  id: 'family-1',
  familyId: 'GJ-FAM-8A72K91X',
  status: 'DRAFT',
  familyHeadId: 'member-1',
  members,
};

const existing = {
  id: 'rel-1',
  relationshipType: 'SPOUSE',
  verificationStatus: 'PENDING',
  rejectionReason: null,
  fromMember: { id: 'member-1', name: 'Rahul Patel' },
  toMember: { id: 'member-2', name: 'Priya Patel' },
};

function mockLoaded({ memberList = members, relationships = [existing] } = {}) {
  familyApi.getMyFamily.mockResolvedValue({ data: { family } });
  memberApi.listMembers.mockResolvedValue({
    data: { familyId: family.familyId, familyHeadId: 'member-1', members: memberList },
  });
  relationshipApi.listForFamily.mockResolvedValue({
    data: { familyId: family.familyId, relationships },
  });
}

async function openDialogAndFill(user, { from, type, to }) {
  await user.click(screen.getByRole('button', { name: /add relationship/i }));
  const dialog = await screen.findByRole('dialog');
  await user.selectOptions(within(dialog).getByLabelText(/^member$/i), from);
  await user.selectOptions(within(dialog).getByLabelText(/^is the$/i), type);
  await user.selectOptions(within(dialog).getByLabelText(/^of$/i), to);
  return dialog;
}

describe('FamilyRelationshipsPage — listing', () => {
  it('reads each relationship as a sentence', async () => {
    mockLoaded();
    renderWithProviders(<App />, { route: '/family/relationships', user: citizen });

    const table = await screen.findByRole('table');
    expect(table).toHaveTextContent('Rahul Patel is the spouse of Priya Patel');
  });

  it('shows the verification status', async () => {
    mockLoaded();
    renderWithProviders(<App />, { route: '/family/relationships', user: citizen });

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Pending')).toBeInTheDocument();
  });

  it('shows the officer reason for a rejected relationship', async () => {
    mockLoaded({
      relationships: [
        {
          ...existing,
          verificationStatus: 'REJECTED',
          rejectionReason: 'Marriage certificate missing',
        },
      ],
    });
    renderWithProviders(<App />, { route: '/family/relationships', user: citizen });

    expect(
      await screen.findByText(/marriage certificate missing/i)
    ).toBeInTheDocument();
  });

  it('handles having no relationships yet', async () => {
    mockLoaded({ relationships: [] });
    renderWithProviders(<App />, { route: '/family/relationships', user: citizen });

    expect(
      await screen.findByText(/no relationships recorded yet/i)
    ).toBeInTheDocument();
  });

  it('asks for a second member before allowing a relationship', async () => {
    mockLoaded({ memberList: [members[0]], relationships: [] });
    renderWithProviders(<App />, { route: '/family/relationships', user: citizen });

    expect(
      await screen.findByText(/add at least two family members/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add relationship/i })).toBeDisabled();
  });

  it('prompts registration when there is no family', async () => {
    familyApi.getMyFamily.mockResolvedValue({ data: { family: null } });
    renderWithProviders(<App />, { route: '/family/relationships', user: citizen });

    expect(
      await screen.findByText(/register your family before adding relationships/i)
    ).toBeInTheDocument();
    expect(relationshipApi.listForFamily).not.toHaveBeenCalled();
  });
});

describe('FamilyRelationshipsPage — creating', () => {
  it('records a relationship', async () => {
    const user = userEvent.setup();
    mockLoaded();
    relationshipApi.createRelationship.mockResolvedValue({
      data: {
        relationship: {
          id: 'rel-2',
          relationshipType: 'FATHER',
          verificationStatus: 'PENDING',
          rejectionReason: null,
          fromMember: { id: 'member-1', name: 'Rahul Patel' },
          toMember: { id: 'member-3', name: 'Riya Patel' },
        },
      },
    });

    renderWithProviders(<App />, { route: '/family/relationships', user: citizen });
    await screen.findByRole('table');

    const dialog = await openDialogAndFill(user, {
      from: 'member-1',
      type: 'FATHER',
      to: 'member-3',
    });
    await user.click(
      within(dialog).getByRole('button', { name: /add relationship/i })
    );

    await waitFor(() => {
      expect(relationshipApi.createRelationship).toHaveBeenCalledWith({
        fromMemberId: 'member-1',
        relationshipType: 'FATHER',
        toMemberId: 'member-3',
      });
    });
    expect(
      await screen.findByText(/sent for verification/i)
    ).toBeInTheDocument();
  });

  it('previews the relationship as a sentence before submitting', async () => {
    const user = userEvent.setup();
    mockLoaded();
    renderWithProviders(<App />, { route: '/family/relationships', user: citizen });
    await screen.findByRole('table');

    const dialog = await openDialogAndFill(user, {
      from: 'member-1',
      type: 'FATHER',
      to: 'member-3',
    });

    expect(dialog).toHaveTextContent(
      'Rahul Patel is the father of Riya Patel.'
    );
  });

  it('never offers the same member on both sides', async () => {
    const user = userEvent.setup();
    mockLoaded();
    renderWithProviders(<App />, { route: '/family/relationships', user: citizen });
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: /add relationship/i }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText(/^member$/i), 'member-1');

    const targetOptions = within(within(dialog).getByLabelText(/^of$/i))
      .getAllByRole('option')
      .map((option) => option.value);

    expect(targetOptions).not.toContain('member-1');
  });

  it('explains why an implausible relationship was refused', async () => {
    const user = userEvent.setup();
    mockLoaded();
    relationshipApi.createRelationship.mockRejectedValue(
      new ApiError('Relationship conflicts with the recorded dates of birth', {
        status: 422,
        errors: [
          {
            field: 'relationshipType',
            message: 'Riya Patel is not older than Rahul Patel',
          },
        ],
      })
    );

    renderWithProviders(<App />, { route: '/family/relationships', user: citizen });
    await screen.findByRole('table');

    const dialog = await openDialogAndFill(user, {
      from: 'member-3',
      type: 'MOTHER',
      to: 'member-1',
    });
    await user.click(
      within(dialog).getByRole('button', { name: /add relationship/i })
    );

    // The specific explanation is far more useful than "Validation failed".
    expect(
      await screen.findByText(/riya patel is not older than rahul patel/i)
    ).toBeInTheDocument();
  });

  it('surfaces a duplicate relationship', async () => {
    const user = userEvent.setup();
    mockLoaded();
    relationshipApi.createRelationship.mockRejectedValue(
      new ApiError('This relationship has already been recorded', { status: 409 })
    );

    renderWithProviders(<App />, { route: '/family/relationships', user: citizen });
    await screen.findByRole('table');

    const dialog = await openDialogAndFill(user, {
      from: 'member-1',
      type: 'SPOUSE',
      to: 'member-2',
    });
    await user.click(
      within(dialog).getByRole('button', { name: /add relationship/i })
    );

    expect(
      await screen.findByText(/already been recorded/i)
    ).toBeInTheDocument();
  });
});
