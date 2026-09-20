import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import useAuth from '../hooks/useAuth';
import * as familyApi from '../services/family.service';

export default function CitizenDashboardPage() {
  const { user } = useAuth();

  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    familyApi
      .getMyFamily()
      .then((response) => {
        if (!cancelled) setFamily(response.data.family);
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Welcome, {user?.name}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Register your family to receive a Family ID, then add members and
          supporting documents for verification.
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {loading ? (
        <Spinner label="Loading your family" />
      ) : family ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Family ID
              </p>
              <p className="font-mono text-lg font-bold tracking-tight text-brand-700">
                {family.familyId}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {family.members?.length ?? 0} member
                {family.members?.length === 1 ? '' : 's'} · {family.village},{' '}
                {family.district}
              </p>
            </div>
            <StatusBadge status={family.status} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/family"
              className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              View family
            </Link>
            <Link
              to="/schemes"
              className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Explore Schemes & Benefits
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Link
              to="/family/members"
              className="rounded-lg border border-slate-200 p-3 text-center transition hover:border-brand-300 hover:bg-brand-50/30"
            >
              <p className="text-xs text-slate-500">Members</p>
              <p className="text-base font-bold text-slate-800">{family.members?.length ?? 0}</p>
            </Link>
            <Link
              to="/family/relationships"
              className="rounded-lg border border-slate-200 p-3 text-center transition hover:border-brand-300 hover:bg-brand-50/30"
            >
              <p className="text-xs text-slate-500">Relationships</p>
              <p className="text-base font-bold text-slate-800">Map Tree</p>
            </Link>
            <Link
              to="/family/tree"
              className="rounded-lg border border-slate-200 p-3 text-center transition hover:border-brand-300 hover:bg-brand-50/30"
            >
              <p className="text-xs text-slate-500">Family Tree</p>
              <p className="text-base font-bold text-slate-800">Interactive</p>
            </Link>
            <Link
              to="/family/documents"
              className="rounded-lg border border-slate-200 p-3 text-center transition hover:border-brand-300 hover:bg-brand-50/30"
            >
              <p className="text-xs text-slate-500">Documents</p>
              <p className="text-base font-bold text-slate-800">Verify</p>
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            You have not registered a family yet.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Registration takes a minute and gives you a permanent Family ID.
          </p>
          <Link
            to="/family/register"
            className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Register your family
          </Link>
        </section>
      )}
    </div>
  );
}
