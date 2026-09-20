import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../App';
import { ApiError } from '../services/apiClient';
import * as familyApi from '../services/family.service';
import { renderWithProviders, citizen, officer } from '../test/renderWithProviders';

vi.mock('../services/auth.service');
vi.mock('../services/family.service');

beforeEach(() => {
  vi.resetAllMocks();
});

const registeredFamily = {
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
  ],
};

async function fillRequiredFields(user) {
  await user.type(screen.getByLabelText(/date of birth/i), '1985-04-12');
  await user.selectOptions(screen.getByLabelText(/gender/i), 'MALE');
  await user.type(screen.getByLabelText(/^district/i), 'Ahmedabad');
  await user.type(screen.getByLabelText(/taluka/i), 'Daskroi');
  await user.type(screen.getByLabelText(/village or ward/i), 'Example Village');
  await user.type(screen.getByLabelText(/^address/i), '12 Example Road');
}

describe('FamilyRegistrationPage', () => {
  it('prefills the head name from the signed-in account', async () => {
    renderWithProviders(<App />, { route: '/family/register', user: citizen });

    expect(await screen.findByLabelText(/full name/i)).toHaveValue('Rahul Patel');
  });

  it('explains that the Family ID carries no identity numbers', async () => {
    renderWithProviders(<App />, { route: '/family/register', user: citizen });

    expect(
      await screen.findByText(/never contains aadhaar or other identity numbers/i)
    ).toBeInTheDocument();
  });

  it('submits the form with head details nested for the API', async () => {
    const user = userEvent.setup();
    familyApi.createFamily.mockResolvedValue({ data: { family: registeredFamily } });
    familyApi.getMyFamily.mockResolvedValue({ data: { family: registeredFamily } });

    renderWithProviders(<App />, { route: '/family/register', user: citizen });
    await screen.findByLabelText(/full name/i);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /register family/i }));

    await waitFor(() => {
      expect(familyApi.createFamily).toHaveBeenCalledWith(
        expect.objectContaining({
          district: 'Ahmedabad',
          taluka: 'Daskroi',
          village: 'Example Village',
          address: '12 Example Road',
          head: expect.objectContaining({
            name: 'Rahul Patel',
            dateOfBirth: '1985-04-12',
            gender: 'MALE',
          }),
        })
      );
    });
  });

  it('shows the new Family ID after registering', async () => {
    const user = userEvent.setup();
    familyApi.createFamily.mockResolvedValue({ data: { family: registeredFamily } });
    familyApi.getMyFamily.mockResolvedValue({ data: { family: registeredFamily } });

    renderWithProviders(<App />, { route: '/family/register', user: citizen });
    await screen.findByLabelText(/full name/i);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /register family/i }));

    expect(await screen.findByText(/family registered/i)).toBeInTheDocument();
    expect(await screen.findAllByText(/GJ-FAM-8A72K91X/)).not.toHaveLength(0);
  });

  it('maps nested API validation errors onto the right inputs', async () => {
    const user = userEvent.setup();
    familyApi.createFamily.mockRejectedValue(
      new ApiError('Validation failed', {
        status: 422,
        errors: [
          { field: 'head.dateOfBirth', message: 'Date of birth cannot be in the future' },
          { field: 'district', message: 'District is required' },
        ],
      })
    );

    renderWithProviders(<App />, { route: '/family/register', user: citizen });
    await screen.findByLabelText(/full name/i);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /register family/i }));

    // head.dateOfBirth must land on the flat headDateOfBirth field.
    expect(
      await screen.findByText(/date of birth cannot be in the future/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/district is required/i)).toBeInTheDocument();
  });

  it('shows a banner when a family is already registered', async () => {
    const user = userEvent.setup();
    familyApi.createFamily.mockRejectedValue(
      new ApiError('You have already registered a family', { status: 409 })
    );

    renderWithProviders(<App />, { route: '/family/register', user: citizen });
    await screen.findByLabelText(/full name/i);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /register family/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /already registered a family/i
    );
  });

  it('omits income when it is left blank', async () => {
    const user = userEvent.setup();
    familyApi.createFamily.mockResolvedValue({ data: { family: registeredFamily } });
    familyApi.getMyFamily.mockResolvedValue({ data: { family: registeredFamily } });

    renderWithProviders(<App />, { route: '/family/register', user: citizen });
    await screen.findByLabelText(/full name/i);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /register family/i }));

    await waitFor(() => {
      const payload = familyApi.createFamily.mock.calls[0][0];
      expect(payload).not.toHaveProperty('annualIncome');
    });
  });

  it('sends income as a number when provided', async () => {
    const user = userEvent.setup();
    familyApi.createFamily.mockResolvedValue({ data: { family: registeredFamily } });
    familyApi.getMyFamily.mockResolvedValue({ data: { family: registeredFamily } });

    renderWithProviders(<App />, { route: '/family/register', user: citizen });
    await screen.findByLabelText(/full name/i);
    await fillRequiredFields(user);
    await user.type(screen.getByLabelText(/annual household income/i), '120000');
    await user.click(screen.getByRole('button', { name: /register family/i }));

    await waitFor(() => {
      expect(familyApi.createFamily.mock.calls[0][0].annualIncome).toBe(120000);
    });
  });

  it('keeps an officer out of family registration', async () => {
    renderWithProviders(<App />, { route: '/family/register', user: officer });

    expect(
      await screen.findByRole('heading', { name: /verification dashboard/i })
    ).toBeInTheDocument();
    expect(familyApi.createFamily).not.toHaveBeenCalled();
  });
});
