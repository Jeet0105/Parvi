import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../App';
import { ApiError } from '../services/apiClient';
import * as documentApi from '../services/document.service';
import * as familyApi from '../services/family.service';
import * as memberApi from '../services/member.service';
import { renderWithProviders, citizen, officer } from '../test/renderWithProviders';

vi.mock('../services/auth.service');
vi.mock('../services/family.service');
vi.mock('../services/member.service');
vi.mock('../services/document.service');

beforeEach(() => {
  vi.resetAllMocks();
  documentApi.fileUrl.mockImplementation((id) => `/api/documents/${id}/file`);
});

const members = [
  { id: 'member-1', name: 'Rahul Patel', status: 'ACTIVE' },
  { id: 'member-2', name: 'Riya Patel', status: 'ACTIVE' },
];

const family = { id: 'family-1', familyId: 'GJ-FAM-8A72K91X', members };

const uploaded = {
  id: 'doc-1',
  documentType: 'BIRTH_CERTIFICATE',
  originalName: 'birth.pdf',
  sizeBytes: 24576,
  verificationStatus: 'PENDING',
  rejectionReason: null,
  uploadedAt: '2026-09-18T00:00:00.000Z',
  member: { id: 'member-2', name: 'Riya Patel' },
};

function mockLoaded(documents = [uploaded]) {
  familyApi.getMyFamily.mockResolvedValue({ data: { family } });
  memberApi.listMembers.mockResolvedValue({
    data: { familyId: family.familyId, familyHeadId: 'member-1', members },
  });
  documentApi.listForFamily.mockResolvedValue({
    data: { familyId: family.familyId, documents },
  });
}

const pdfFile = () =>
  new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'birth.pdf', {
    type: 'application/pdf',
  });

describe('FamilyDocumentsPage — listing', () => {
  it('lists uploaded documents', async () => {
    mockLoaded();
    renderWithProviders(<App />, { route: '/family/documents', user: citizen });

    expect(await screen.findByText('Birth Certificate')).toBeInTheDocument();
    expect(screen.getByText('birth.pdf')).toBeInTheDocument();
  });

  it('shows the file size in readable units', async () => {
    mockLoaded();
    renderWithProviders(<App />, { route: '/family/documents', user: citizen });

    expect(await screen.findByText(/\(24 KB\)/)).toBeInTheDocument();
  });

  it('links each file through the authorised route', async () => {
    mockLoaded();
    renderWithProviders(<App />, { route: '/family/documents', user: citizen });

    const link = await screen.findByRole('link', { name: 'birth.pdf' });
    expect(link).toHaveAttribute('href', '/api/documents/doc-1/file');
  });

  it('shows the officer reason for a rejected document', async () => {
    mockLoaded([
      {
        ...uploaded,
        verificationStatus: 'REJECTED',
        rejectionReason: 'Scan is illegible',
      },
    ]);
    renderWithProviders(<App />, { route: '/family/documents', user: citizen });

    expect(await screen.findByText(/scan is illegible/i)).toBeInTheDocument();
  });

  it('handles having no documents', async () => {
    mockLoaded([]);
    renderWithProviders(<App />, { route: '/family/documents', user: citizen });

    expect(
      await screen.findByText(/no documents uploaded yet/i)
    ).toBeInTheDocument();
  });

  it('prompts registration when there is no family', async () => {
    familyApi.getMyFamily.mockResolvedValue({ data: { family: null } });
    renderWithProviders(<App />, { route: '/family/documents', user: citizen });

    expect(
      await screen.findByText(/register your family before uploading/i)
    ).toBeInTheDocument();
    expect(documentApi.listForFamily).not.toHaveBeenCalled();
  });

  it('keeps an officer out of citizen document management', async () => {
    renderWithProviders(<App />, { route: '/family/documents', user: officer });

    expect(
      await screen.findByRole('heading', { name: /verification dashboard/i })
    ).toBeInTheDocument();
    expect(documentApi.listForFamily).not.toHaveBeenCalled();
  });
});

describe('FamilyDocumentsPage — uploading', () => {
  async function openAndFill(user) {
    await user.click(screen.getByRole('button', { name: /upload document/i }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText(/member/i), 'member-2');
    await user.selectOptions(
      within(dialog).getByLabelText(/document type/i),
      'BIRTH_CERTIFICATE'
    );
    return dialog;
  }

  it('uploads a file', async () => {
    const user = userEvent.setup();
    mockLoaded([]);
    documentApi.uploadDocument.mockResolvedValue({ data: { document: uploaded } });

    renderWithProviders(<App />, { route: '/family/documents', user: citizen });
    await screen.findByText(/no documents uploaded yet/i);

    const dialog = await openAndFill(user);
    await user.upload(within(dialog).getByLabelText(/^file/i), pdfFile());
    await user.click(within(dialog).getByRole('button', { name: /^upload$/i }));

    await waitFor(() => {
      expect(documentApi.uploadDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: 'member-2',
          documentType: 'BIRTH_CERTIFICATE',
          file: expect.any(File),
        })
      );
    });
    expect(
      await screen.findByText(/sent for verification/i)
    ).toBeInTheDocument();
  });

  it('refuses to submit without a file', async () => {
    const user = userEvent.setup();
    mockLoaded([]);

    renderWithProviders(<App />, { route: '/family/documents', user: citizen });
    await screen.findByText(/no documents uploaded yet/i);

    const dialog = await openAndFill(user);
    await user.click(within(dialog).getByRole('button', { name: /^upload$/i }));

    expect(await screen.findByText(/choose a file to upload/i)).toBeInTheDocument();
    expect(documentApi.uploadDocument).not.toHaveBeenCalled();
  });

  it('states the accepted formats and size limit', async () => {
    const user = userEvent.setup();
    mockLoaded([]);

    renderWithProviders(<App />, { route: '/family/documents', user: citizen });
    await screen.findByText(/no documents uploaded yet/i);
    await user.click(screen.getByRole('button', { name: /upload document/i }));

    expect(
      await screen.findByText(/pdf, jpeg or png, up to 5 mb/i)
    ).toBeInTheDocument();
  });

  it('surfaces a rejected file type from the server', async () => {
    const user = userEvent.setup();
    mockLoaded([]);
    documentApi.uploadDocument.mockRejectedValue(
      new ApiError('Unsupported file type', {
        status: 422,
        errors: [{ field: 'file', message: 'Upload a PDF, JPEG or PNG file' }],
      })
    );

    renderWithProviders(<App />, { route: '/family/documents', user: citizen });
    await screen.findByText(/no documents uploaded yet/i);

    const dialog = await openAndFill(user);
    await user.upload(within(dialog).getByLabelText(/^file/i), pdfFile());
    await user.click(within(dialog).getByRole('button', { name: /^upload$/i }));

    expect(
      await screen.findByText(/upload a pdf, jpeg or png file/i)
    ).toBeInTheDocument();
  });

  it('surfaces an oversized file', async () => {
    const user = userEvent.setup();
    mockLoaded([]);
    documentApi.uploadDocument.mockRejectedValue(
      new ApiError('File is too large. The maximum is 5 MB.', { status: 413 })
    );

    renderWithProviders(<App />, { route: '/family/documents', user: citizen });
    await screen.findByText(/no documents uploaded yet/i);

    const dialog = await openAndFill(user);
    await user.upload(within(dialog).getByLabelText(/^file/i), pdfFile());
    await user.click(within(dialog).getByRole('button', { name: /^upload$/i }));

    expect(await screen.findByText(/too large/i)).toBeInTheDocument();
  });
});
