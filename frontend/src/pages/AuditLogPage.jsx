import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Alert from '../components/Alert';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import * as auditApi from '../services/audit.service';
import { formatDate } from '../utils/format';

function ActionBadge({ action }) {
  const colorMap = {
    CREATED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    VERIFIED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    REJECTED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    UPDATED: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    ADDED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    FLAGGED: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    REVIEWED: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
    SUBMITTED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    CHANGED: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    UPLOADED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    APPLIED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  };

  const keyword = Object.keys(colorMap).find((k) =>
    action?.toUpperCase().includes(k)
  );
  const style = colorMap[keyword] || 'bg-slate-100 text-slate-600 ring-slate-300/40';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style}`}
    >
      {action?.replace(/_/g, ' ')}
    </span>
  );
}

const ENTITY_TYPES = [
  '',
  'Family',
  'FamilyMember',
  'Relationship',
  'Document',
  'DuplicateReview',
  'BeneficiaryApplication',
  'User',
  'Scheme',
];

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await auditApi.listAuditLogs({
        page,
        pageSize: 20,
        entityType: entityFilter || undefined,
      });
      setLogs(response.data.logs || []);
      if (response.data.pagination) {
        setPagination(response.data.pagination);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, entityFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Audit Trail
            </h1>
            <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-800 ring-1 ring-inset ring-violet-600/20">
              Phase 16
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Complete chronological record of every significant operation in the system.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="">All entities</option>
            {ENTITY_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>
                {t.replace(/([A-Z])/g, ' $1').trim()}
              </option>
            ))}
          </select>
          <Link to="/officer">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {loading ? (
        <Spinner label="Loading audit trail" />
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-xs">
          <p className="text-base font-medium text-slate-800">No audit records found</p>
          <p className="text-xs text-slate-400 mt-1">
            Operations like family creation, verifications, and approvals are automatically logged here.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3" scope="col">Timestamp</th>
                <th className="px-6 py-3" scope="col">Action</th>
                <th className="px-6 py-3" scope="col">Entity</th>
                <th className="px-6 py-3" scope="col">User</th>
                <th className="px-6 py-3" scope="col">Reason / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-slate-50/60 transition-colors"
                >
                  <td className="px-6 py-3 text-xs text-slate-600 whitespace-nowrap">
                    {formatDate(log.createdAt)}{' '}
                    <span className="text-slate-400">
                      {new Date(log.createdAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <ActionBadge action={log.action} />
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <span className="text-xs text-slate-500">{log.entityType}:</span>{' '}
                    <span className="font-mono text-xs text-slate-800">
                      {log.entityId?.slice(0, 8)}...
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-700 whitespace-nowrap">
                    {log.user ? (
                      <span>
                        <span className="font-medium">{log.user.name}</span>
                        <span className="text-slate-400"> · {log.user.role?.replace(/_/g, ' ')}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">System</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-600 max-w-xs truncate">
                    {log.reason || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-slate-50/40">
              <span className="text-xs text-slate-600">
                Page <span className="font-semibold">{pagination.page}</span> of{' '}
                <span className="font-semibold">{pagination.totalPages}</span>
                {' · '}{pagination.total} total records
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={pagination.page >= pagination.totalPages || loading}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
