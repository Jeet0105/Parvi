import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Alert from '../components/Alert';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import useAuth from '../hooks/useAuth';
import * as schemeApi from '../services/scheme.service';
import * as beneficiaryApi from '../services/beneficiary.service';
import * as familyApi from '../services/family.service';
import { formatDate, ageFrom } from '../utils/format';

function EligibilityBadge({ eligible }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        eligible
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
          : 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-300/40'
      }`}
    >
      {eligible ? '✓ Eligible' : '✗ Not eligible'}
    </span>
  );
}

function ApplicationStatusBadge({ status }) {
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

export default function SchemesPage() {
  const { user } = useAuth();

  const [family, setFamily] = useState(null);
  const [schemeData, setSchemeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [applyModal, setApplyModal] = useState(null); // { scheme, member }
  const [busyApply, setBusyApply] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const familyRes = await familyApi.getMyFamily();
      const fam = familyRes.data.family;
      setFamily(fam);

      if (fam) {
        const eligRes = await schemeApi.getEligibleSchemes(fam.id);
        setSchemeData(eligRes.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApply = async () => {
    if (!applyModal) return;
    setBusyApply(true);
    setError('');
    try {
      await beneficiaryApi.applyForScheme({
        schemeId: applyModal.scheme.id,
        memberId: applyModal.member.id,
      });
      setNotice(
        `Application for "${applyModal.scheme.name}" submitted successfully for ${applyModal.member.name}.`
      );
      setApplyModal(null);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyApply(false);
    }
  };

  if (loading) return <Spinner label="Loading eligible schemes" />;

  if (!family) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Government Schemes
        </h1>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            Register a family first to check eligibility for government schemes.
          </p>
          <Link
            to="/family/register"
            className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Register your family
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Government Schemes
            </h1>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
              Phase 13–15
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Eligible welfare programmes for your family · Family{' '}
            <span className="font-mono font-semibold text-brand-700">
              {family?.familyId}
            </span>
          </p>
        </div>
        <Link to="/family">
          <Button variant="secondary">Back to Family</Button>
        </Link>
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {/* Scheme Cards */}
      {!schemeData?.schemes?.length ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-xs">
          <p className="text-base font-medium text-slate-800">No schemes available</p>
          <p className="text-xs text-slate-400 mt-1">
            Schemes will appear here once an administrator adds them to the platform.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {schemeData.schemes.map(({ scheme, eligibleMembersCount, members }) => (
            <div
              key={scheme.id}
              className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden transition hover:shadow-md"
            >
              {/* Scheme Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4 bg-slate-50/50">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {scheme.name}
                  </h3>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {scheme.description}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold tracking-tight ${
                      eligibleMembersCount > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {eligibleMembersCount} eligible member
                    {eligibleMembersCount === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {/* Members */}
              <div className="divide-y divide-slate-100">
                {members.map((entry) => (
                  <div
                    key={entry.member.id}
                    className={`flex flex-wrap items-center justify-between gap-3 px-6 py-3 ${
                      entry.eligible ? 'bg-white' : 'bg-slate-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                          entry.eligible
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {entry.member.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {entry.member.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {entry.member.gender} · Age{' '}
                          {ageFrom(entry.member.dateOfBirth) ?? '?'} ·{' '}
                          {entry.member.isStudent ? 'Student' : 'Non-student'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <EligibilityBadge eligible={entry.eligible} />

                      {entry.application ? (
                        <ApplicationStatusBadge status={entry.application.status} />
                      ) : entry.eligible ? (
                        <Button
                          variant="primary"
                          onClick={() =>
                            setApplyModal({ scheme, member: entry.member })
                          }
                        >
                          Apply
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {/* Eligibility Criteria Footnote */}
              {scheme.eligibilityRule && (
                <div className="border-t border-slate-100 px-6 py-3 bg-slate-50/30">
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">
                      Eligibility criteria:
                    </span>{' '}
                    {Object.entries(scheme.eligibilityRule)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' · ')}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Apply Confirmation Modal */}
      {applyModal && (
        <Modal
          title="Apply for Scheme"
          onClose={() => setApplyModal(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              You are about to apply{' '}
              <span className="font-semibold text-slate-900">
                {applyModal.member.name}
              </span>{' '}
              for the{' '}
              <span className="font-semibold text-slate-900">
                {applyModal.scheme.name}
              </span>{' '}
              scheme.
            </p>
            <p className="text-xs text-slate-500">
              Once submitted, a verification officer will review the application.
              You can track the status from this page.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setApplyModal(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={busyApply}
                onClick={handleApply}
              >
                {busyApply ? 'Submitting...' : 'Confirm Application'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
