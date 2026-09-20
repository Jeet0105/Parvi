import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../App';
import { ApiError } from '../services/apiClient';
import * as familyApi from '../services/family.service';
import * as memberApi from '../services/member.service';
import { renderWithProviders, citizen, officer } from '../test/renderWithProviders';

vi.mock('../services/auth.service');
vi.mock('../services/family.service');
vi.mock('../services/member.service');

beforeEach(() => {
  vi.resetAllMocks();
});

const head = {
  id: 'member-1',
  name: 'Rahul Patel',
  dateOfBirth: '1985-04-12T00:00:00.000Z',
  gender: 'MALE',
  verificationStatus: 'PENDING',
  status: 'ACTIVE',
};

const spouse = {
  id: 'member-2',
  name: 'Priya Patel',
  dateOfBirth: '1988-05-12T00:00:00.000Z',
  gender: 'FEMALE',
  verificationStatus: 'VERIFIED',
  status: 'ACTIVE',
};

const family = {
  id: 'family-1',
  familyId: 'GJ-FAM-8A72K91X',
  status: 'DRAFT',
  district: 'Ahmedabad',
  familyHeadId: 'member-1',
  familyHead: head,
  members: [head, spouse],
};

function mockLoaded(members = [head, spouse]) {
  familyApi.getMyFamily.mockResolvedValue({ data: { family } });
  memberApi.listMembers.mockResolvedValue({
    data: { familyId: family.familyId, familyHeadId: family.familyHeadId, members },
  });
}

const rowFor = (name) =>
  within(screen.getByRole('table')).getByText(name).closest('tr');

describe('FamilyMembersPage — listing', () => {
  it('lists every member', async () => {
    mockLoaded();
    renderWithProviders(<App />, { route: '/family/members', user: citizen });

    expect(await screen.findByText('Priya Patel')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Rahul Patel')).toBeInTheDocument();
  });

  it('marks the Family Head', async () => {
    mockLoaded();
    renderWithProviders(<App />, { route: '/family/members', user: citizen });

    await screen.findByText('Priya Patel');
    expect(within(rowFor('Rahul Patel')).getByText('Head')).toBeInTheDocument();
  });

  it('explains that members are never deleted', async () => {
    mockLoaded();
    renderWithProviders(<App />, { route: '/family/members', user: citizen });

    expect(
      await screen.findByText(/members are never deleted/i)
    ).toBeInTheDocument();
  });

  it('prompts registration when there is no family', async () => {
    familyApi.getMyFamily.mockResolvedValue({ data: { family: null } });
    renderWithProviders(<App />, { route: '/family/members', user: citizen });

    expect(
      await screen.findByText(/register your family before adding members/i)
    ).toBeInTheDocument();
    expect(memberApi.listMembers).not.toHaveBeenCalled();
  });

  it('keeps an officer out of member management', async () => {
    renderWithProviders(<App />, { route: '/family/members', user: officer });

    expect(
      await screen.findByRole('heading', { name: /verification dashboard/i })
    ).toBeInTheDocument();
    expect(memberApi.listMembers).not.toHaveBeenCalled();
  });
});

describe('FamilyMembersPage — adding', () => {
  it('adds a member through the dialog', async () => {
    const user = userEvent.setup();
    mockLoaded();
    memberApi.addMember.mockResolvedValue({
      data: {
        member: {
          id: 'member-3',
          name: 'Riya Patel',
          dateOfBirth: '2010-02-02T00:00:00.000Z',
          gender: 'FEMALE',
          verificationStatus: 'PENDING',
          status: 'ACTIVE',
        },
      },
    });

    renderWithProviders(<App />, { route: '/family/members', user: citizen });
    await screen.findByText('Priya Patel');

    await user.click(screen.getByRole('button', { name: /add member/i }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/full name/i), 'Riya Patel');
    await user.type(within(dialog).getByLabelText(/date of birth/i), '2010-02-02');
    await user.selectOptions(within(dialog).getByLabelText(/gender/i), 'FEMALE');
    await user.click(within(dialog).getByRole('button', { name: /^add member$/i }));

    await waitFor(() => {
      expect(memberApi.addMember).toHaveBeenCalledWith(
        'family-1',
        expect.objectContaining({
          name: 'Riya Patel',
          dateOfBirth: '2010-02-02',
          gender: 'FEMALE',
        })
      );
    });

    expect(
      await screen.findByText(/riya patel was added to your family/i)
    ).toBeInTheDocument();
  });

  it('omits blank optional fields from the payload', async () => {
    const user = userEvent.setup();
    mockLoaded();
    memberApi.addMember.mockResolvedValue({
      data: { member: { ...spouse, id: 'member-3', name: 'Riya Patel' } },
    });

    renderWithProviders(<App />, { route: '/family/members', user: citizen });
    await screen.findByText('Priya Patel');
    await user.click(screen.getByRole('button', { name: /add member/i }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/full name/i), 'Riya Patel');
    await user.type(within(dialog).getByLabelText(/date of birth/i), '2010-02-02');
    await user.selectOptions(within(dialog).getByLabelText(/gender/i), 'FEMALE');
    await user.click(within(dialog).getByRole('button', { name: /^add member$/i }));

    await waitFor(() => {
      const payload = memberApi.addMember.mock.calls[0][1];
      // Sending "" would fail the API's minimum-length rule.
      expect(payload).not.toHaveProperty('fatherName');
      expect(payload).not.toHaveProperty('spouseName');
    });
  });

  it('shows validation errors from the API inside the dialog', async () => {
    const user = userEvent.setup();
    mockLoaded();
    memberApi.addMember.mockRejectedValue(
      new ApiError('Validation failed', {
        status: 422,
        errors: [
          { field: 'dateOfBirth', message: 'Date of birth cannot be in the future' },
        ],
      })
    );

    renderWithProviders(<App />, { route: '/family/members', user: citizen });
    await screen.findByText('Priya Patel');
    await user.click(screen.getByRole('button', { name: /add member/i }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/full name/i), 'Future Child');
    await user.type(within(dialog).getByLabelText(/date of birth/i), '2999-01-01');
    await user.selectOptions(within(dialog).getByLabelText(/gender/i), 'OTHER');
    await user.click(within(dialog).getByRole('button', { name: /^add member$/i }));

    expect(
      await screen.findByText(/date of birth cannot be in the future/i)
    ).toBeInTheDocument();
  });

  it('surfaces the member cap', async () => {
    const user = userEvent.setup();
    mockLoaded();
    memberApi.addMember.mockRejectedValue(
      new ApiError('A family cannot have more than 50 members', { status: 409 })
    );

    renderWithProviders(<App />, { route: '/family/members', user: citizen });
    await screen.findByText('Priya Patel');
    await user.click(screen.getByRole('button', { name: /add member/i }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/full name/i), 'One Too Many');
    await user.type(within(dialog).getByLabelText(/date of birth/i), '2000-01-01');
    await user.selectOptions(within(dialog).getByLabelText(/gender/i), 'OTHER');
    await user.click(within(dialog).getByRole('button', { name: /^add member$/i }));

    expect(
      await screen.findByText(/cannot have more than 50 members/i)
    ).toBeInTheDocument();
  });
});

describe('FamilyMembersPage — editing and lifecycle', () => {
  it('disables editing for a verified member', async () => {
    mockLoaded();
    renderWithProviders(<App />, { route: '/family/members', user: citizen });

    await screen.findByText('Priya Patel');
    // Priya is VERIFIED; her details are frozen.
    expect(within(rowFor('Priya Patel')).getByRole('button', { name: /edit/i })).toBeDisabled();
    expect(within(rowFor('Rahul Patel')).getByRole('button', { name: /edit/i })).toBeEnabled();
  });

  it('records a lifecycle status change', async () => {
    const user = userEvent.setup();
    mockLoaded();
    memberApi.updateMember.mockResolvedValue({
      data: { member: { ...spouse, status: 'MIGRATED' } },
    });

    renderWithProviders(<App />, { route: '/family/members', user: citizen });
    await screen.findByText('Priya Patel');

    await user.selectOptions(
      screen.getByLabelText(/status for priya patel/i),
      'MIGRATED'
    );

    await waitFor(() => {
      expect(memberApi.updateMember).toHaveBeenCalledWith('member-2', {
        status: 'MIGRATED',
      });
    });
    expect(
      await screen.findByText(/priya patel is now migrated/i)
    ).toBeInTheDocument();
  });

  it('surfaces the refusal to retire the Family Head', async () => {
    const user = userEvent.setup();
    mockLoaded();
    memberApi.updateMember.mockRejectedValue(
      new ApiError(
        'Assign a new Family Head before changing the current head status',
        { status: 409 }
      )
    );

    renderWithProviders(<App />, { route: '/family/members', user: citizen });
    await screen.findByText('Priya Patel');

    await user.selectOptions(
      screen.getByLabelText(/status for rahul patel/i),
      'DECEASED'
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /assign a new family head/i
    );
  });

  it('reassigns the Family Head', async () => {
    const user = userEvent.setup();
    mockLoaded();
    memberApi.changeFamilyHead.mockResolvedValue({
      data: { family: { ...family, familyHeadId: 'member-2', familyHead: spouse } },
    });

    renderWithProviders(<App />, { route: '/family/members', user: citizen });
    await screen.findByText('Priya Patel');

    await user.click(
      within(rowFor('Priya Patel')).getByRole('button', { name: /make head/i })
    );

    await waitFor(() => {
      expect(memberApi.changeFamilyHead).toHaveBeenCalledWith('family-1', 'member-2');
    });
    expect(
      await screen.findByText(/priya patel is now the family head/i)
    ).toBeInTheDocument();
  });

  it('offers no "make head" action on the current head', async () => {
    mockLoaded();
    renderWithProviders(<App />, { route: '/family/members', user: citizen });

    await screen.findByText('Priya Patel');
    expect(
      within(rowFor('Rahul Patel')).queryByRole('button', { name: /make head/i })
    ).not.toBeInTheDocument();
  });

  it('hides "make head" for a member who has left the household', async () => {
    mockLoaded([head, { ...spouse, status: 'MIGRATED' }]);
    renderWithProviders(<App />, { route: '/family/members', user: citizen });

    await screen.findByText('Priya Patel');
    expect(
      within(rowFor('Priya Patel')).queryByRole('button', { name: /make head/i })
    ).not.toBeInTheDocument();
  });

  it('surfaces the refusal to edit a verified member', async () => {
    const user = userEvent.setup();
    mockLoaded([head, { ...spouse, verificationStatus: 'PENDING' }]);
    memberApi.updateMember.mockRejectedValue(
      new ApiError(
        'A verified member cannot have their details edited. Submit a correction request.',
        { status: 409 }
      )
    );

    renderWithProviders(<App />, { route: '/family/members', user: citizen });
    await screen.findByText('Priya Patel');

    await user.click(within(rowFor('Priya Patel')).getByRole('button', { name: /edit/i }));
    const dialog = await screen.findByRole('dialog');
    await user.clear(within(dialog).getByLabelText(/full name/i));
    await user.type(within(dialog).getByLabelText(/full name/i), 'Changed Name');
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    expect(
      await screen.findByText(/correction request/i)
    ).toBeInTheDocument();
  });

  it('prefills the edit dialog with existing details', async () => {
    const user = userEvent.setup();
    mockLoaded();
    renderWithProviders(<App />, { route: '/family/members', user: citizen });

    await screen.findByText('Priya Patel');
    await user.click(within(rowFor('Rahul Patel')).getByRole('button', { name: /edit/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/full name/i)).toHaveValue('Rahul Patel');
    // The ISO timestamp is trimmed for the date input.
    expect(within(dialog).getByLabelText(/date of birth/i)).toHaveValue('1985-04-12');
  });
});
