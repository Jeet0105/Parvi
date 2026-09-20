import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Alert from '../components/Alert';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import * as beneficiaryApi from '../services/beneficiary.service';
import { formatDate } from '../utils/format';

function StatusBadge({ status }) {
  const styles = {
    APPLIED: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    UNDER_REVIEW: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    REJECTED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
        styles[status] || 'bg-slate-100 text-slate-600'
      }`}
    >
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

export default function BeneficiaryQueuePage() {
  const [applications, setApplications] = useState([]);
  const [statusFilter, setStatusFilter] = useState('APPLIED');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [decisionModal, setDecisionModal] = useState(null); // { app, action }
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await beneficiaryApi.listApplications({
        status: statusFilter === 'ALL' ? '' : statusFilter,
      });
      setApplications(response.data.applications || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpenDecision = (app, action) => {
    setDecisionModal({ app, action });
    setReason('');
  };

  const handleConfirmDecision = async (e) => {
    e.preventDefault();
    if (!decisionModal) return;

    const { app, action } = decisionModal;
    setBusyId(app.id);
    setError('');
    try {
      await beneficiaryApi.reviewApplication(app.id, {
        action,
        decisionReason: reason,
      });
      setNotice(
        `Application ${action === 'APPROVE' ? 'approved' : 'rejected'} for ${app.member?.name || 'member'}.`
      );
      setDecisionModal(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Beneficiary Applications
            </h1>
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 ring-1 ring-inset ring-indigo-600/20">
              Phase 15
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Review and process government scheme applications from verified families.
          </p>
        </div>
        <Link to="/officer">
          <Button variant="secondary">Back to Dashboard</Button>
        </Link>
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: 'APPLIED', label: 'New Applications' },
          { id: 'UNDER_REVIEW', label: 'Under Review' },
          { id: 'APPROVED', label: 'Approved' },
          { id: 'REJECTED', label: 'Rejected' },
          { id: 'ALL', label: 'All' },
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

      {/* Application list */}
      {loading ? (
        <Spinner label="Loading beneficiary applications" />
      ) : applications.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-xs">
          <p className="text-base font-medium text-slate-800">No applications in this view</p>
          <p className="text-xs text-slate-400 mt-1">
            Applications will appear here when citizens apply for welfare schemes.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3" scope="col">Applicant</th>
                <th className="px-6 py-3" scope="col">Scheme</th>
                <th className="px-6 py-3" scope="col">Family</th>
                <th className="px-6 py-3" scope="col">Applied</th>
                <th className="px-6 py-3" scope="col">Status</th>
                <th className="px-6 py-3 text-right" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applications.map((app) => {
                const isPending =
                  app.status === 'APPLIED' || app.status === 'UNDER_REVIEW';

                return (
                  <tr
                    key={app.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                          {app.member?.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {app.member?.name || 'Unknown'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {app.member?.gender}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-slate-800 font-medium">
                      {app.scheme?.name || 'Scheme'}
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-600 font-mono">
                      {app.family?.familyId || app.familyId?.slice(0, 8)}
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {formatDate(app.appliedAt)}
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-6 py-3 text-right">
                      {isPending ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            disabled={busyId === app.id}
                            onClick={() => handleOpenDecision(app, 'REJECT')}
                          >
                            Reject
                          </Button>
                          <Button
                            variant="primary"
                            disabled={busyId === app.id}
                            onClick={() => handleOpenDecision(app, 'APPROVE')}
                          >
                            Approve
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {app.reviewedBy?.name
                            ? `By ${app.reviewedBy.name}`
                            : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Decision Modal */}
      {decisionModal && (
        <Modal
          title={
            decisionModal.action === 'APPROVE'
              ? 'Approve Application'
              : 'Reject Application'
          }
          onClose={() => setDecisionModal(null)}
        >
          <form onSubmit={handleConfirmDecision} className="space-y-4">
            <p className="text-sm text-slate-600">
              {decisionModal.action === 'APPROVE'
                ? `You are approving ${decisionModal.app.member?.name}'s application for "${decisionModal.app.scheme?.name}". This grants them beneficiary status.`
                : `You are rejecting ${decisionModal.app.member?.name}'s application for "${decisionModal.app.scheme?.name}".`}
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Decision Reason {decisionModal.action === 'REJECT' ? '(Required)' : '(Optional)'}
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide reason for this decision..."
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-brand-500 focus:outline-none"
                required={decisionModal.action === 'REJECT'}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setDecisionModal(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busyId !== null}>
                {decisionModal.action === 'APPROVE'
                  ? 'Confirm Approval'
                  : 'Confirm Rejection'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
