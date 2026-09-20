import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../App';
import { ApiError } from '../services/apiClient';
import * as documentApi from '../services/document.service';
import * as familyApi from '../services/family.service';
import { renderWithProviders, citizen, officer, admin } from '../test/renderWithProviders';

vi.mock('../services/auth.service');
vi.mock('../services/family.service');
vi.mock('../services/document.service');

beforeEach(() => {
  vi.resetAllMocks();
  documentApi.fileUrl.mockImplementation((id) => `/api/documents/${id}/file`);
});

const districtOfficer = {
  id: 'user-4',
  name: 'District Officer',
  email: 'district@example.gov',
  mobile: '9876500002',
  role: 'DISTRICT_OFFICER',
};

const pendingDoc = {
  id: 'doc-1',
  documentType: 'BIRTH_CERTIFICATE',
  originalName: 'birth.pdf',
  verificationStatus: 'PENDING',
  uploadedAt: '2026-09-18T00:00:00.000Z',
  member: {
    id: 'member-2',
    name: 'Riya Patel',
    family: { id: 'family-1', familyId: 'GJ-FAM-8A72K91X', district: 'Ahmedabad' },
  },
};

function mockQueue(documents = [pendingDoc]) {
  documentApi.listPending.mockResolvedValue({
    data: {
      documents,
      pagination: { page: 1, pageSize: 25, total: documents.length, totalPages: 1 },
    },
  });
}

describe('DocumentQueuePage', () => {
  it('lists documents awaiting a decision', async () => {
    mockQueue();
    renderWithProviders(<App />, { route: '/officer/documents', user: officer });

    expect(await screen.findByText('GJ-FAM-8A72K91X')).toBeInTheDocument();
    expect(screen.getByText('Birth Certificate')).toBeInTheDocument();
    expect(screen.getByText('Riya Patel')).toBeInTheDocument();
  });

  it('links the file for review', async () => {
    mockQueue();
    renderWithProviders(<App />, { route: '/officer/documents', user: officer });

    const link = await screen.findByRole('link', { name: /open birth\.pdf/i });
    expect(link).toHaveAttribute('href', '/api/documents/doc-1/file');
  });

  it('reports how many are waiting', async () => {
    mockQueue();
    renderWithProviders(<App />, { route: '/officer/documents', user: officer });

    expect(
      await screen.findByText(/1 document awaiting a decision/i)
    ).toBeInTheDocument();
  });

  it('shows an empty queue clearly', async () => {
    mockQueue([]);
    renderWithProviders(<App />, { route: '/officer/documents', user: officer });

    expect(
      await screen.findByText(/no documents are waiting/i)
    ).toBeInTheDocument();
  });

  it('approves a document and drops it from the queue', async () => {
    const user = userEvent.setup();
    mockQueue();
    documentApi.verifyDocument.mockResolvedValue({
      data: { document: { ...pendingDoc, verificationStatus: 'VERIFIED' } },
    });

    renderWithProviders(<App />, { route: '/officer/documents', user: officer });
    await screen.findByText('GJ-FAM-8A72K91X');
    await user.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => {
      expect(documentApi.verifyDocument).toHaveBeenCalledWith('doc-1', {
        action: 'APPROVE',
      });
    });
    expect(screen.queryByText('GJ-FAM-8A72K91X')).not.toBeInTheDocument();
  });

  it('requires a reason before rejecting', async () => {
    const user = userEvent.setup();
    mockQueue();

    renderWithProviders(<App />, { route: '/officer/documents', user: officer });
    await screen.findByText('GJ-FAM-8A72K91X');
    await user.click(screen.getByRole('button', { name: /^reject$/i }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /reject document/i }));

    expect(await screen.findByText(/give a reason/i)).toBeInTheDocument();
    expect(documentApi.verifyDocument).not.toHaveBeenCalled();
  });

  it('rejects with a reason', async () => {
    const user = userEvent.setup();
    mockQueue();
    documentApi.verifyDocument.mockResolvedValue({
      data: { document: { ...pendingDoc, verificationStatus: 'REJECTED' } },
    });

    renderWithProviders(<App />, { route: '/officer/documents', user: officer });
    await screen.findByText('GJ-FAM-8A72K91X');
    await user.click(screen.getByRole('button', { name: /^reject$/i }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/reason/i), 'Scan is illegible');
    await user.click(within(dialog).getByRole('button', { name: /reject document/i }));

    await waitFor(() => {
      expect(documentApi.verifyDocument).toHaveBeenCalledWith('doc-1', {
        action: 'REJECT',
        reason: 'Scan is illegible',
      });
    });
  });

  it('lets an admin decide', async () => {
    const user = userEvent.setup();
    mockQueue();
    documentApi.verifyDocument.mockResolvedValue({
      data: { document: { ...pendingDoc, verificationStatus: 'VERIFIED' } },
    });

    renderWithProviders(<App />, { route: '/officer/documents', user: admin });
    await screen.findByText('GJ-FAM-8A72K91X');
    await user.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => expect(documentApi.verifyDocument).toHaveBeenCalled());
  });

  it('shows a district officer the queue without decision controls', async () => {
    mockQueue();
    renderWithProviders(<App />, { route: '/officer/documents', user: districtOfficer });

    await screen.findByText('GJ-FAM-8A72K91X');
    expect(screen.getByText(/can review this queue but not decide/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled();
  });

  it('keeps a citizen out', async () => {
    familyApi.getMyFamily.mockResolvedValue({ data: { family: null } });
    renderWithProviders(<App />, { route: '/officer/documents', user: citizen });

    expect(await screen.findByText(/welcome, rahul patel/i)).toBeInTheDocument();
    expect(documentApi.listPending).not.toHaveBeenCalled();
  });

  it('surfaces a server refusal and keeps the row', async () => {
    const user = userEvent.setup();
    mockQueue();
    documentApi.verifyDocument.mockRejectedValue(
      new ApiError('Document is already VERIFIED', { status: 409 })
    );

    renderWithProviders(<App />, { route: '/officer/documents', user: officer });
    await screen.findByText('GJ-FAM-8A72K91X');
    await user.click(screen.getByRole('button', { name: /approve/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already verified/i);
    expect(screen.getByText('GJ-FAM-8A72K91X')).toBeInTheDocument();
  });
});
