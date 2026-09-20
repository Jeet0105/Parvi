import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

import Alert from '../components/Alert';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import useAuth from '../hooks/useAuth';
import * as verificationApi from '../services/verification.service';
import { roleLabel } from '../utils/roles';
import { formatDate } from '../utils/format';

function formatAuditAction(action) {
  const map = {
    FAMILY_VERIFIED: { label: 'Family Verified', color: 'emerald' },
    FAMILY_REJECTED: { label: 'Family Rejected', color: 'rose' },
    MEMBER_VERIFIED: { label: 'Member Verified', color: 'emerald' },
    MEMBER_REJECTED: { label: 'Member Rejected', color: 'rose' },
    RELATIONSHIP_VERIFIED: { label: 'Relationship Verified', color: 'emerald' },
    RELATIONSHIP_REJECTED: { label: 'Relationship Rejected', color: 'rose' },
    DOCUMENT_VERIFIED: { label: 'Document Verified', color: 'emerald' },
    DOCUMENT_REJECTED: { label: 'Document Rejected', color: 'rose' },
    DUPLICATE_REVIEWED: { label: 'Duplicate Reviewed', color: 'indigo' },
    BENEFICIARY_APPROVED: { label: 'Beneficiary Approved', color: 'emerald' },
    BENEFICIARY_REJECTED: { label: 'Beneficiary Rejected', color: 'rose' },
  };

  return map[action] || { label: action?.replace(/_/g, ' ') || 'Action', color: 'slate' };
}

function StatCard({ label, value = 0, to, tone = 'default', subtitle }) {
  const body = (
    <div className="flex flex-col justify-between h-full">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
        <p
          className={`mt-2 text-3xl font-extrabold tabular-nums tracking-tight ${
            tone === 'attention' && value > 0 ? 'text-amber-600' : 'text-slate-900'
          }`}
        >
          {value}
        </p>
      </div>
      {subtitle && <p className="mt-2 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );

  const className =
    'relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 text-left shadow-xs transition hover:shadow-md';

  return to ? (
    <Link
      to={to}
      className={`${className} hover:border-brand-400 hover:bg-brand-50/30 group`}
    >
      {body}
      <div className="mt-3 inline-flex items-center text-xs font-semibold text-brand-700 group-hover:underline">
        Open queue &rarr;
      </div>
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export default function OfficerDashboardPage() {
  const { user, role } = useAuth();

  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyPagination, setHistoryPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [historyPage, setHistoryPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    try {
      const response = await verificationApi.getStatistics();
      setStats(response.data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadHistory = useCallback(async (page = 1) => {
    if (!verificationApi.getVerificationHistory) return;
    setHistoryLoading(true);
    try {
      const response = await verificationApi.getVerificationHistory({ page, pageSize: 8 });
      if (response?.data) {
        setHistory(response.data.history || []);
        if (response.data.pagination) {
          setHistoryPagination(response.data.pagination);
        }
      }
    } catch (err) {
      // Don't fail the whole dashboard if history query fails
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadStats(), loadHistory(1)]).finally(() => setLoading(false));
  }, [loadStats, loadHistory]);

  const handlePageChange = (newPage) => {
    setHistoryPage(newPage);
    loadHistory(newPage);
  };

  if (loading) return <Spinner label="Loading dashboard" />;

  return (
    <div className="space-y-8">
      {/* Header section with status badges */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Verification Dashboard
            </h1>
            <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/20">
              Phase 11
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {user?.name} · {roleLabel(role)}
            {stats?.scope ? ` · ${stats.scope}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/officer/audit">
            <Button variant="secondary">Audit Trail</Button>
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              loadStats();
              loadHistory(historyPage);
            }}
          >
            Refresh Data
          </Button>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {stats && (
        <>
          {/* Queues awaiting decision */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-900">
                Awaiting a decision
              </h2>
              <span className="text-xs text-slate-500">Real-time verification queues</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <StatCard
                label="Families"
                value={stats.pendingFamilies}
                to="/officer/families"
                tone="attention"
                subtitle="Awaiting whole verification"
              />
              <StatCard
                label="Relationships"
                value={stats.pendingRelationships}
                to="/officer/relationships"
                tone="attention"
                subtitle="Kinship verification"
              />
              <StatCard
                label="Documents"
                value={stats.pendingDocuments}
                to="/officer/documents"
                tone="attention"
                subtitle="Proofs & certificates"
              />
              <StatCard
                label="Duplicate alerts"
                value={stats.duplicateAlerts ?? 0}
                to="/officer/duplicates"
                tone="attention"
                subtitle="Potential person matches"
              />
              <StatCard
                label="Beneficiary apps"
                value={stats.pendingApplications ?? 0}
                to="/officer/beneficiaries"
                tone="attention"
                subtitle="Government welfare schemes"
              />
              <StatCard
                label="Members"
                value={stats.pendingMembers}
                to="/officer/families"
                tone="attention"
                subtitle="Individual records"
              />
            </div>
          </section>

          {/* Platform overview figures */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-slate-900">
              Registered families
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Verified families"
                value={stats.verifiedFamilies}
                subtitle="Fully checked & approved"
              />
              <StatCard
                label="Total families"
                value={stats.totalFamilies}
                subtitle="All families in jurisdiction"
              />
            </div>
          </section>

          {stats.pendingFamilies === 0 &&
            stats.pendingRelationships === 0 &&
            stats.pendingDocuments === 0 && (
              <Alert tone="success">
                Every queue is clear. Nothing is waiting for a decision.
              </Alert>
            )}

          {/* Live Verification History Feed */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Verification History
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Audit log of recent decisions made by verification officers
                </p>
              </div>
              {historyPagination.total > 0 && (
                <span className="text-xs font-medium text-slate-500">
                  {historyPagination.total} total decision{historyPagination.total === 1 ? '' : 's'}
                </span>
              )}
            </div>

            {historyLoading ? (
              <div className="p-8">
                <Spinner label="Loading verification history" />
              </div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No verification activity recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-6 py-3" scope="col">Date & Time</th>
                      <th className="px-6 py-3" scope="col">Decision</th>
                      <th className="px-6 py-3" scope="col">Target Entity</th>
                      <th className="px-6 py-3" scope="col">Officer</th>
                      <th className="px-6 py-3" scope="col">Reason / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((item) => {
                      const badge = formatAuditAction(item.action);
                      const isApproved = badge.color === 'emerald';
                      const isRejected = badge.color === 'rose';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-3 text-xs text-slate-600 whitespace-nowrap">
                            {formatDate(item.createdAt)}{' '}
                            <span className="text-slate-400">
                              {new Date(item.createdAt).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                                isApproved
                                  ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20'
                                  : isRejected
                                  ? 'bg-rose-50 text-rose-800 ring-rose-600/20'
                                  : 'bg-indigo-50 text-indigo-800 ring-indigo-600/20'
                              }`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-slate-800 font-medium whitespace-nowrap">
                            <span className="text-slate-500 font-normal">{item.entityType}:</span>{' '}
                            <span className="font-mono text-xs">{item.entityId.slice(0, 8)}...</span>
                          </td>
                          <td className="px-6 py-3 text-slate-700 whitespace-nowrap text-xs">
                            <span className="font-medium">{item.user?.name || 'Officer'}</span>
                            {item.user?.district && (
                              <span className="text-slate-400"> ({item.user.district})</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-slate-600 text-xs max-w-xs truncate">
                            {item.reason || item.newValue?.rejectionReason || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {historyPagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-slate-50/40">
                <span className="text-xs text-slate-600">
                  Page <span className="font-semibold">{historyPagination.page}</span> of{' '}
                  <span className="font-semibold">{historyPagination.totalPages}</span>
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={historyPagination.page <= 1 || historyLoading}
                    onClick={() => handlePageChange(historyPagination.page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={historyPagination.page >= historyPagination.totalPages || historyLoading}
                    onClick={() => handlePageChange(historyPagination.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

