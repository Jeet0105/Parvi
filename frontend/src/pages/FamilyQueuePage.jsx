import { useCallback, useEffect, useState } from 'react';

import Alert from '../components/Alert';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import useAuth from '../hooks/useAuth';
import * as verificationApi from '../services/verification.service';
import { ROLES } from '../utils/roles';
import { ageFrom, formatDate } from '../utils/format';

export default function FamilyQueuePage() {
  const { role } = useAuth();
  const canDecide = role === ROLES.VERIFICATION_OFFICER || role === ROLES.ADMIN;

  const [families, setFamilies] = useState([]);
  const [expanded, setExpanded] = useState(null);
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
      const response = await verificationApi.listPendingFamilies();
      setFamilies(response.data.families);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateMemberInPlace = (familyId, member) => {
    setFamilies((prev) =>
      prev.map((family) =>
        family.id === familyId
          ? {
              ...family,
              members: family.members.map((m) =>
                m.id === member.id ? { ...m, ...member } : m
              ),
            }
          : family
      )
    );
  };

  const handleMemberDecision = async (family, member, action) => {
    setBusyId(member.id);
    setError('');
    setNotice('');
    try {
      const response = await verificationApi.verifyMember(member.id, { action });
      updateMemberInPlace(family.id, response.data.member);
      setNotice(`${member.name} marked ${action === 'APPROVE' ? 'verified' : 'rejected'}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleApproveFamily = async (family) => {
    setBusyId(family.id);
    setError('');
    setNotice('');
    try {
      await verificationApi.verifyFamily(family.id, { action: 'APPROVE' });
      setFamilies((prev) => prev.filter((f) => f.id !== family.id));
      setNotice(`${family.familyId} is now verified.`);
    } catch (err) {
      // The common refusal is unverified members, which is actionable.
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectFamily = async (event) => {
    event.preventDefault();
    if (reason.trim().length < 3) {
      setReasonError('Give a reason so the family knows what to correct');
      return;
    }

    setBusyId(rejecting.id);
    setError('');
    try {
      await verificationApi.verifyFamily(rejecting.id, {
        action: 'REJECT',
        reason: reason.trim(),
      });
      setFamilies((prev) => prev.filter((f) => f.id !== rejecting.id));
      setNotice(`${rejecting.familyId} was returned to the family.`);
      setRejecting(null);
      setReason('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const activeMembers = (family) =>
    family.members.filter((m) => m.status === 'ACTIVE');

  const remaining = (family) =>
    activeMembers(family).filter((m) => m.verificationStatus !== 'VERIFIED').length;

  if (loading) return <Spinner label="Loading family queue" />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Family verification queue
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {families.length} famil{families.length === 1 ? 'y' : 'ies'} submitted
          for review.
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {!canDecide && (
        <Alert tone="info">
          Your role can review this queue but not decide on it.
        </Alert>
      )}

      {families.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
          No families are waiting for verification.
        </p>
      ) : (
        <ul className="space-y-3">
          {families.map((family) => {
            const outstanding = remaining(family);
            const isOpen = expanded === family.id;

            return (
              <li
                key={family.id}
                className="rounded-xl border border-slate-200 bg-white"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="font-mono text-sm font-bold text-brand-700">
                      {family.familyId}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Head: {family.familyHead?.name || '—'} · {family.village},{' '}
                      {family.district}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {family._count?.members ?? family.members.length} members ·{' '}
                      {family._count?.relationships ?? 0} relationships ·
                      submitted {formatDate(family.updatedAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setExpanded(isOpen ? null : family.id)}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? 'Hide members' : `Review members (${outstanding})`}
                    </Button>
                    <Button
                      disabled={!canDecide || busyId === family.id}
                      onClick={() => handleApproveFamily(family)}
                    >
                      Verify family
                    </Button>
                    <Button
                      variant="danger"
                      disabled={!canDecide || busyId === family.id}
                      onClick={() => {
                        setRejecting(family);
                        setReason('');
                        setReasonError('');
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-200 px-5 py-4">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">
                        Members of {family.familyId}
                      </caption>
                      <thead className="text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th scope="col" className="py-2 font-semibold">Name</th>
                          <th scope="col" className="py-2 font-semibold">Age</th>
                          <th scope="col" className="py-2 font-semibold">Status</th>
                          <th scope="col" className="py-2 font-semibold">Verification</th>
                          <th scope="col" className="py-2 font-semibold">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {family.members.map((member) => (
                          <tr key={member.id}>
                            <td className="py-2 font-medium text-slate-800">
                              {member.name}
                              {member.id === family.familyHeadId && (
                                <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700">
                                  Head
                                </span>
                              )}
                            </td>
                            <td className="py-2 text-slate-600">
                              {ageFrom(member.dateOfBirth) ?? '—'}
                            </td>
                            <td className="py-2 text-slate-600">{member.status}</td>
                            <td className="py-2">
                              <StatusBadge
                                status={member.verificationStatus}
                                kind="verification"
                              />
                            </td>
                            <td className="py-2">
                              <div className="flex justify-end gap-2">
                                <Button
                                  disabled={
                                    !canDecide ||
                                    busyId === member.id ||
                                    member.verificationStatus === 'VERIFIED'
                                  }
                                  onClick={() =>
                                    handleMemberDecision(family, member, 'APPROVE')
                                  }
                                >
                                  Verify
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {outstanding > 0 && (
                      <p className="mt-3 text-xs text-slate-500">
                        {outstanding} member{outstanding === 1 ? '' : 's'} still
                        need verifying before the family can be verified.
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Reject family registration"
      >
        <form onSubmit={handleRejectFamily} noValidate className="space-y-4">
          <p className="text-sm text-slate-600">{rejecting?.familyId}</p>

          <div className="space-y-1.5">
            <label
              htmlFor="family-reject-reason"
              className="block text-sm font-medium text-slate-700"
            >
              Reason<span className="ml-0.5 text-red-600">*</span>
            </label>
            <textarea
              id="family-reject-reason"
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
              Reject family
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
