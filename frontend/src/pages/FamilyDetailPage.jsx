import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import Alert from '../components/Alert';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import * as familyApi from '../services/family.service';
import * as verificationApi from '../services/verification.service';
import { ageFrom, formatCurrency, formatDate } from '../utils/format';

function SummaryRow({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800">{children}</dd>
    </div>
  );
}

export default function FamilyDetailPage() {
  const location = useLocation();
  const justCreated = location.state?.justCreated;

  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await familyApi.getMyFamily();
      setFamily(response.data.family);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmitForVerification = async () => {
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const response = await verificationApi.submitFamily(family.id);
      setFamily(response.data.family);
      setNotice('Your family has been submitted for verification.');
    } catch (err) {
      setError(err.errors?.[0]?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner label="Loading your family" />;

  // Only a failure to load replaces the page; a failed submission is shown
  // inline so the family record stays visible.
  if (error && !family) {
    return <Alert tone="error">{error}</Alert>;
  }

  if (!family) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-700">
          You have not registered a family yet.
        </p>
        <Link
          to="/family/register"
          className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Register your family
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {justCreated && (
        <Alert tone="success" title="Family registered">
          Your Family ID is <strong>{justCreated}</strong>. Keep it for your records.
        </Alert>
      )}

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {family.status === 'REJECTED' && family.rejectionReason && (
        <Alert tone="error" title="Returned by a verification officer">
          {family.rejectionReason}
        </Alert>
      )}

      {family.status === 'PENDING_VERIFICATION' && (
        <Alert tone="info">
          Your family is with a verification officer. You can still add members
          and documents while you wait.
        </Alert>
      )}

      {(family.status === 'DRAFT' || family.status === 'REJECTED') && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Ready for verification?
            </p>
            <p className="mt-0.5 text-sm text-slate-600">
              Upload a supporting document for each member first, then submit.
            </p>
          </div>
          <Button onClick={handleSubmitForVerification} loading={submitting}>
            Submit for verification
          </Button>
        </section>
      )}

      {family.status === 'VERIFIED' && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-emerald-950">
              Family Verified & Eligible for Government Schemes
            </p>
            <p className="mt-0.5 text-sm text-emerald-800">
              Your family identity is fully certified. Explore welfare schemes and apply for benefits now.
            </p>
          </div>
          <Link
            to="/schemes"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700"
          >
            Explore & Apply Schemes
          </Link>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Family ID</p>
            <p className="font-mono text-lg font-bold tracking-tight text-brand-700">
              {family.familyId}
            </p>
          </div>
          <StatusBadge status={family.status} />
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryRow label="Family Head">
            {family.familyHead?.name || '—'}
          </SummaryRow>
          <SummaryRow label="Members">{family.members?.length ?? 0}</SummaryRow>
          <SummaryRow label="Registered">{formatDate(family.createdAt)}</SummaryRow>
          <SummaryRow label="District">{family.district}</SummaryRow>
          <SummaryRow label="Taluka">{family.taluka}</SummaryRow>
          <SummaryRow label="Village">{family.village}</SummaryRow>
          <SummaryRow label="Address">{family.address}</SummaryRow>
          <SummaryRow label="Annual income">
            {formatCurrency(family.annualIncome)}
          </SummaryRow>
          <SummaryRow label="Owns a house">
            {family.ownsHouse ? 'Yes' : 'No'}
          </SummaryRow>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Members</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Members of this family</caption>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-6 py-3 font-semibold">Name</th>
                <th scope="col" className="px-6 py-3 font-semibold">Date of birth</th>
                <th scope="col" className="px-6 py-3 font-semibold">Age</th>
                <th scope="col" className="px-6 py-3 font-semibold">Gender</th>
                <th scope="col" className="px-6 py-3 font-semibold">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {family.members?.map((member) => (
                <tr key={member.id}>
                  <td className="px-6 py-3 font-medium text-slate-800">
                    {member.name}
                    {member.id === family.familyHeadId && (
                      <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">
                        Head
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {formatDate(member.dateOfBirth)}
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {ageFrom(member.dateOfBirth) ?? '—'}
                  </td>
                  <td className="px-6 py-3 text-slate-600">{member.gender}</td>
                  <td className="px-6 py-3">
                    <StatusBadge status={member.verificationStatus} kind="verification" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
