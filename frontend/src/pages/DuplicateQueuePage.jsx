import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Alert from '../components/Alert';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import useAuth from '../hooks/useAuth';
import * as duplicateApi from '../services/duplicate.service';
import { ROLES } from '../utils/roles';
import { formatDate, ageFrom } from '../utils/format';

export default function DuplicateQueuePage() {
  const { role } = useAuth();
  const canDecide = role === ROLES.VERIFICATION_OFFICER || role === ROLES.ADMIN;
  const isAdmin = role === ROLES.ADMIN;

  const [duplicates, setDuplicates] = useState([]);
  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [decisionModal, setDecisionModal] = useState(null); // { item, decision }
  const [reviewNote, setReviewNote] = useState('');
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await duplicateApi.listDuplicates({
        status: statusFilter === 'ALL' ? '' : statusFilter,
      });
      setDuplicates(response.data.duplicates || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpenDecision = (item, decision) => {
    setDecisionModal({ item, decision });
    setReviewNote('');
  };

  const handleConfirmDecision = async (e) => {
    e.preventDefault();
    if (!decisionModal) return;

    const { item, decision } = decisionModal;
    setBusyId(item.id);
    setError('');
    try {
      await duplicateApi.decideDuplicate(item.id, {
        decision,
        reviewNote,
      });
      setNotice(
        `Marked as ${decision === 'SAME_PERSON' ? 'Same Person' : 'Different Person'}.`
      );
      setDecisionModal(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleTriggerScan = async () => {
    setScanning(true);
    setError('');
    setNotice('');
    try {
      const res = await duplicateApi.triggerScan();
      setNotice(`Scan completed: Scanned ${res.data.scanned} members, found ${res.data.flagged} potential duplicate candidates.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Duplicate Detection Queue
            </h1>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">
              Phase 12
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Intelligent demographic matching flags suspected duplicate identities for officer review.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="secondary"
              disabled={scanning}
              onClick={handleTriggerScan}
            >
              {scanning ? 'Scanning...' : 'Run System Scan'}
            </Button>
          )}
          <Link to="/officer">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
        </div>
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: 'PENDING_REVIEW', label: 'Pending Review' },
          { id: 'SAME_PERSON', label: 'Resolved: Same Person' },
          { id: 'DIFFERENT_PERSON', label: 'Resolved: Different Person' },
          { id: 'ALL', label: 'All Candidates' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
              statusFilter === tab.id
                ? 'border-brand-600 text-brand-700 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Loading duplicate candidate alerts" />
      ) : duplicates.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-xs">
          <p className="text-base font-medium text-slate-800">No duplicate alerts in this view</p>
          <p className="text-xs text-slate-400 mt-1">
            The similarity engine continuously evaluates members as they register.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {duplicates.map((dup) => {
            const m1 = dup.sourceMember;
            const m2 = dup.matchedMember;
            const breakdown = dup.breakdown || {};
            const isPending = dup.status === 'PENDING_REVIEW';

            return (
              <div
                key={dup.id}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-5 transition hover:shadow-md"
              >
                {/* Alert Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-md px-3 py-1 text-sm font-bold tracking-tight ${
                        dup.score >= 85
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {dup.score}% Similarity Match
                    </span>
                    <span className="text-xs text-slate-500">
                      Flagged on {formatDate(dup.createdAt)}
                    </span>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        dup.status === 'SAME_PERSON'
                          ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'
                          : dup.status === 'DIFFERENT_PERSON'
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                          : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
                      }`}
                    >
                      {dup.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Explainable Similarity Breakdown */}
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Explainable Match Score Breakdown
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                    <div className="rounded-md bg-white p-2 border border-slate-200">
                      <span className="text-slate-500">Name match</span>
                      <p className="mt-0.5 text-base font-bold text-slate-800">{breakdown.name ?? 0}%</p>
                    </div>
                    <div className="rounded-md bg-white p-2 border border-slate-200">
                      <span className="text-slate-500">Date of birth</span>
                      <p className="mt-0.5 text-base font-bold text-slate-800">{breakdown.dateOfBirth ?? 0}%</p>
                    </div>
                    <div className="rounded-md bg-white p-2 border border-slate-200">
                      <span className="text-slate-500">Father name</span>
                      <p className="mt-0.5 text-base font-bold text-slate-800">{breakdown.fatherName ?? 0}%</p>
                    </div>
                    <div className="rounded-md bg-white p-2 border border-slate-200">
                      <span className="text-slate-500">Location / Address</span>
                      <p className="mt-0.5 text-base font-bold text-slate-800">{breakdown.address ?? 0}%</p>
                    </div>
                  </div>
                </div>

                {/* Side-by-Side Comparison */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Record A */}
                  <div className="rounded-lg border border-slate-200 p-4 bg-white/70">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                        Record A
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {m1.family?.familyId || 'Family'}
                      </span>
                    </div>
                    <dl className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Full Name:</dt>
                        <dd className="font-semibold text-slate-900">{m1.name}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Date of Birth:</dt>
                        <dd className="text-slate-800">{formatDate(m1.dateOfBirth)} ({ageFrom(m1.dateOfBirth)} yrs)</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Gender:</dt>
                        <dd className="text-slate-800">{m1.gender}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Father's Name:</dt>
                        <dd className="text-slate-800">{m1.fatherName || '—'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Location:</dt>
                        <dd className="text-slate-800">{m1.family?.village}, {m1.family?.district}</dd>
                      </div>
                    </dl>
                  </div>

                  {/* Record B */}
                  <div className="rounded-lg border border-slate-200 p-4 bg-white/70">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                        Record B (Potential Match)
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {m2.family?.familyId || 'Family'}
                      </span>
                    </div>
                    <dl className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Full Name:</dt>
                        <dd className="font-semibold text-slate-900">{m2.name}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Date of Birth:</dt>
                        <dd className="text-slate-800">{formatDate(m2.dateOfBirth)} ({ageFrom(m2.dateOfBirth)} yrs)</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Gender:</dt>
                        <dd className="text-slate-800">{m2.gender}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Father's Name:</dt>
                        <dd className="text-slate-800">{m2.fatherName || '—'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Location:</dt>
                        <dd className="text-slate-800">{m2.family?.village}, {m2.family?.district}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Review Note / Decision Details */}
                {dup.reviewNote && (
                  <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-md">
                    <span className="font-medium text-slate-700">Officer Note:</span> {dup.reviewNote}{' '}
                    {dup.reviewedBy && <span className="text-slate-400">· Reviewed by {dup.reviewedBy.name}</span>}
                  </div>
                )}

                {/* Officer Decision Controls */}
                {isPending && canDecide && (
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button
                      variant="secondary"
                      disabled={busyId === dup.id}
                      onClick={() => handleOpenDecision(dup, 'DIFFERENT_PERSON')}
                    >
                      Mark Different Person
                    </Button>
                    <Button
                      variant="primary"
                      disabled={busyId === dup.id}
                      onClick={() => handleOpenDecision(dup, 'SAME_PERSON')}
                    >
                      Confirm Same Person
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Decision Modal */}
      {decisionModal && (
        <Modal
          title={
            decisionModal.decision === 'SAME_PERSON'
              ? 'Confirm Same Person'
              : 'Mark as Different Person'
          }
          onClose={() => setDecisionModal(null)}
        >
          <form onSubmit={handleConfirmDecision} className="space-y-4">
            <p className="text-sm text-slate-600">
              {decisionModal.decision === 'SAME_PERSON'
                ? 'You are recording that Record A and Record B belong to the same biological individual. Records will remain distinct in the database with this adjudication attached.'
                : 'You are confirming that Record A and Record B are separate individuals despite demographic similarities.'}
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Officer Review Note (Optional)
              </label>
              <textarea
                rows={3}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Explain the findings from identity verification or document review..."
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setDecisionModal(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busyId !== null}>
                Submit Decision
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
