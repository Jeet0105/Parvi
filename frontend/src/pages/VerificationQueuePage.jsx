import { useCallback, useEffect, useState } from 'react';

import Alert from '../components/Alert';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import useAuth from '../hooks/useAuth';
import * as relationshipApi from '../services/relationship.service';
import { ROLES } from '../utils/roles';
import { formatDate, relationshipLabel } from '../utils/format';

export default function VerificationQueuePage() {
  const { role } = useAuth();
  const canDecide = role === ROLES.VERIFICATION_OFFICER || role === ROLES.ADMIN;

  const [relationships, setRelationships] = useState([]);
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
      const response = await relationshipApi.listPending();
      setRelationships(response.data.relationships);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const removeFromQueue = (id) =>
    setRelationships((prev) => prev.filter((r) => r.id !== id));

  const handleApprove = async (relationship) => {
    setBusyId(relationship.id);
    setError('');
    setNotice('');
    try {
      await relationshipApi.verifyRelationship(relationship.id, {
        action: 'APPROVE',
      });
      removeFromQueue(relationship.id);
      setNotice(
        `Verified: ${relationship.fromMember.name} is the ${relationshipLabel(
          relationship.relationshipType
        ).toLowerCase()} of ${relationship.toMember.name}.`
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
      setReasonError('Give a reason so the family knows what to correct');
      return;
    }

    setBusyId(rejecting.id);
    setError('');
    try {
      await relationshipApi.verifyRelationship(rejecting.id, {
        action: 'REJECT',
        reason: reason.trim(),
      });
      removeFromQueue(rejecting.id);
      setNotice(`Rejected relationship for ${rejecting.toMember.name}.`);
      setRejecting(null);
      setReason('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Spinner label="Loading verification queue" />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Relationship verification queue
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {relationships.length} relationship
          {relationships.length === 1 ? '' : 's'} awaiting a decision.
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {!canDecide && (
        <Alert tone="info">
          Your role can review this queue but not decide on it.
        </Alert>
      )}

      {relationships.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
          Nothing is waiting for verification.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Relationships awaiting verification</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Family</th>
                <th scope="col" className="px-4 py-3 font-semibold">Claim</th>
                <th scope="col" className="px-4 py-3 font-semibold">Submitted</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {relationships.map((rel) => (
                <tr key={rel.id}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-semibold text-brand-700">
                      {rel.family.familyId}
                    </p>
                    <p className="text-xs text-slate-500">{rel.family.district}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-800">
                    <span className="font-medium">{rel.fromMember.name}</span>
                    <span className="text-slate-500">
                      {' '}is the {relationshipLabel(rel.relationshipType).toLowerCase()} of{' '}
                    </span>
                    <span className="font-medium">{rel.toMember.name}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(rel.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={rel.verificationStatus} kind="verification" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        disabled={!canDecide || busyId === rel.id}
                        onClick={() => handleApprove(rel)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        disabled={!canDecide || busyId === rel.id}
                        onClick={() => {
                          setRejecting(rel);
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
        title="Reject relationship"
      >
        <form onSubmit={handleReject} noValidate className="space-y-4">
          <p className="text-sm text-slate-600">
            {rejecting?.fromMember.name} is the{' '}
            {relationshipLabel(rejecting?.relationshipType).toLowerCase()} of{' '}
            {rejecting?.toMember.name}
          </p>

          <div className="space-y-1.5">
            <label htmlFor="reject-reason" className="block text-sm font-medium text-slate-700">
              Reason<span className="ml-0.5 text-red-600">*</span>
            </label>
            <textarea
              id="reject-reason"
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
              The family sees this, so say what needs correcting.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={busyId === rejecting?.id}>
              Reject relationship
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
