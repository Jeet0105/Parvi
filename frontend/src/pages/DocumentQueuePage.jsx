import { useCallback, useEffect, useState } from 'react';

import Alert from '../components/Alert';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import useAuth from '../hooks/useAuth';
import * as documentApi from '../services/document.service';
import { ROLES } from '../utils/roles';
import { documentTypeLabel, formatDate } from '../utils/format';

export default function DocumentQueuePage() {
  const { role } = useAuth();
  const canDecide = role === ROLES.VERIFICATION_OFFICER || role === ROLES.ADMIN;

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await documentApi.listPending();
      setDocuments(response.data.documents);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = (id) => setDocuments((prev) => prev.filter((d) => d.id !== id));

  const handleApprove = async (doc) => {
    setBusyId(doc.id);
    setError('');
    setNotice('');
    try {
      await documentApi.verifyDocument(doc.id, { action: 'APPROVE' });
      remove(doc.id);
      setNotice(
        `Verified ${documentTypeLabel(doc.documentType)} for ${doc.member.name}.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (event) => {
    event.preventDefault();
    if (reason.trim().length < 3) {
      setReasonError('Give a reason so the family knows what to re-upload');
      return;
    }

    setBusyId(rejecting.id);
    setError('');
    try {
      await documentApi.verifyDocument(rejecting.id, {
        action: 'REJECT',
        reason: reason.trim(),
      });
      remove(rejecting.id);
      setNotice(`Rejected document for ${rejecting.member.name}.`);
      setRejecting(null);
      setReason('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Spinner label="Loading document queue" />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Document verification queue
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {documents.length} document{documents.length === 1 ? '' : 's'} awaiting
          a decision.
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {!canDecide && (
        <Alert tone="info">
          Your role can review this queue but not decide on it.
        </Alert>
      )}

      {documents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
          No documents are waiting for verification.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Documents awaiting verification</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Family</th>
                <th scope="col" className="px-4 py-3 font-semibold">Document</th>
                <th scope="col" className="px-4 py-3 font-semibold">Member</th>
                <th scope="col" className="px-4 py-3 font-semibold">Uploaded</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-semibold text-brand-700">
                      {doc.member.family.familyId}
                    </p>
                    <p className="text-xs text-slate-500">
                      {doc.member.family.district}
                    </p>
                  </td>
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
                      Open {doc.originalName}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{doc.member.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(doc.uploadedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={doc.verificationStatus}
                      kind="verification"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        disabled={!canDecide || busyId === doc.id}
                        onClick={() => handleApprove(doc)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        disabled={!canDecide || busyId === doc.id}
                        onClick={() => {
                          setRejecting(doc);
                          setReason('');
                          setReasonError('');
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Reject document"
      >
        <form onSubmit={handleReject} noValidate className="space-y-4">
          <p className="text-sm text-slate-600">
            {documentTypeLabel(rejecting?.documentType)} for{' '}
            {rejecting?.member.name}
          </p>

          <div className="space-y-1.5">
            <label
              htmlFor="document-reject-reason"
              className="block text-sm font-medium text-slate-700"
            >
              Reason<span className="ml-0.5 text-red-600">*</span>
            </label>
            <textarea
              id="document-reject-reason"
              rows={3}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setReasonError('');
              }}
              aria-invalid={reasonError ? 'true' : undefined}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {reasonError && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {reasonError}
              </p>
            )}
            <p className="text-xs text-slate-500">
              The family sees this, so say what needs re-uploading.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={busyId === rejecting?.id}>
              Reject document
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
