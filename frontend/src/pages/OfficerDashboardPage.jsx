import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import useAuth from '../hooks/useAuth';
import * as verificationApi from '../services/verification.service';
import { roleLabel } from '../utils/roles';

function StatCard({ label, value, to, tone = 'default' }) {
  const body = (
    <>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          tone === 'attention' && value > 0 ? 'text-amber-600' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </>
  );

  const className =
    'block rounded-xl border border-slate-200 bg-white px-4 py-3 text-left';

  return to ? (
    <Link to={to} className={`${className} transition hover:border-brand-300 hover:bg-brand-50/40`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export default function OfficerDashboardPage() {
  const { user, role } = useAuth();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    verificationApi
      .getStatistics()
      .then((response) => {
        if (!cancelled) setStats(response.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Spinner label="Loading dashboard" />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Verification dashboard
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {user?.name} · {roleLabel(role)}
          {stats?.scope ? ` · ${stats.scope}` : ''}
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {stats && (
        <>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">
              Awaiting a decision
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Families"
                value={stats.pendingFamilies}
                to="/officer/families"
                tone="attention"
              />
              <StatCard
                label="Members"
                value={stats.pendingMembers}
                to="/officer/families"
                tone="attention"
              />
              <StatCard
                label="Relationships"
                value={stats.pendingRelationships}
                to="/officer/relationships"
                tone="attention"
              />
              <StatCard
                label="Documents"
                value={stats.pendingDocuments}
                to="/officer/documents"
                tone="attention"
              />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">
              Registered families
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Verified" value={stats.verifiedFamilies} />
              <StatCard label="Total" value={stats.totalFamilies} />
            </div>
          </section>

          {stats.pendingFamilies === 0 &&
            stats.pendingRelationships === 0 &&
            stats.pendingDocuments === 0 && (
              <Alert tone="success">
                Every queue is clear. Nothing is waiting for a decision.
              </Alert>
            )}
        </>
      )}
    </div>
  );
}
