import { useCallback, useEffect, useRef, useState } from 'react';

import Alert from '../components/Alert';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import * as documentApi from '../services/document.service';
import * as familyApi from '../services/family.service';
import * as memberApi from '../services/member.service';
import {
  DOCUMENT_TYPES,
  documentTypeLabel,
  formatDate,
  formatFileSize,
} from '../utils/format';

const ACCEPTED = '.pdf,.jpg,.jpeg,.png';

export default function FamilyDocumentsPage() {
  const fileInputRef = useRef(null);

  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ memberId: '', documentType: '' });
  const [file, setFile] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const familyResponse = await familyApi.getMyFamily();
      const loaded = familyResponse.data.family;
      setFamily(loaded);

      if (loaded) {
        const [memberResponse, documentResponse] = await Promise.all([
          memberApi.listMembers(loaded.id),
          documentApi.listForFamily(loaded.id),
        ]);
        setMembers(memberResponse.data.members);
        setDocuments(documentResponse.data.documents);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm({ memberId: '', documentType: '' });
    setFile(null);
    setFormError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    if (!file) {
      setFormError('Choose a file to upload.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await documentApi.uploadDocument({ ...form, file });
      setDocuments((prev) => [response.data.document, ...prev]);
      setUploading(false);
      resetForm();
      setNotice('Document uploaded and sent for verification.');
    } catch (err) {
      setFormError(err.errors?.[0]?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const nameOf = (id) => members.find((m) => m.id === id)?.name || 'Unknown';

  if (loading) return <Spinner label="Loading documents" />;

  if (!family) {
    return <Alert tone="info">Register your family before uploading documents.</Alert>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Documents</h2>
          <p className="mt-1 text-sm text-slate-600">
            Upload proof for each member. A verification officer reviews every
            document before it counts towards your verified record.
          </p>
        </div>
        <Button onClick={() => setUploading(true)}>Upload document</Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {documents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
          No documents uploaded yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Uploaded supporting documents</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Document</th>
                <th scope="col" className="px-4 py-3 font-semibold">Member</th>
                <th scope="col" className="px-4 py-3 font-semibold">Uploaded</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">Officer note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">
                      {documentTypeLabel(doc.documentType)}
                    </p>
                    <a
                      href={documentApi.fileUrl(doc.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand-600 hover:underline"
                    >
                      {doc.originalName}
                    </a>
                    <span className="ml-1 text-xs text-slate-400">
                      ({formatFileSize(doc.sizeBytes)})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{doc.member?.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(doc.uploadedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={doc.verificationStatus}
                      kind="verification"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {doc.rejectionReason || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={uploading}
        onClose={() => {
          setUploading(false);
          resetForm();
        }}
        title="Upload document"
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {formError && <Alert tone="error">{formError}</Alert>}

          <div className="space-y-1.5">
            <label htmlFor="memberId" className="block text-sm font-medium text-slate-700">
              Member<span className="ml-0.5 text-red-600">*</span>
            </label>
            <select
              id="memberId"
              value={form.memberId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, memberId: event.target.value }))
              }
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select a member</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="documentType" className="block text-sm font-medium text-slate-700">
              Document type<span className="ml-0.5 text-red-600">*</span>
            </label>
            <select
              id="documentType"
              value={form.documentType}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, documentType: event.target.value }))
              }
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select a type</option>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {documentTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="file" className="block text-sm font-medium text-slate-700">
              File<span className="ml-0.5 text-red-600">*</span>
            </label>
            <input
              id="file"
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setFormError('');
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm"
            />
            <p className="text-xs text-slate-500">
              PDF, JPEG or PNG, up to 5 MB.
            </p>
          </div>

          {form.memberId && form.documentType && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {documentTypeLabel(form.documentType)} for {nameOf(form.memberId)}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setUploading(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Upload
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
