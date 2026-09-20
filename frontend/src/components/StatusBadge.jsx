import { familyStatusLabel, verificationLabel } from '../utils/format';

const TONES = {
  DRAFT: 'bg-slate-100 text-slate-700 ring-slate-200',
  PENDING: 'bg-amber-50 text-amber-800 ring-amber-200',
  PENDING_VERIFICATION: 'bg-amber-50 text-amber-800 ring-amber-200',
  UNDER_REVIEW: 'bg-blue-50 text-blue-800 ring-blue-200',
  VERIFIED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  REJECTED: 'bg-red-50 text-red-800 ring-red-200',
};

export default function StatusBadge({ status, kind = 'family' }) {
  const label =
    kind === 'family' ? familyStatusLabel(status) : verificationLabel(status);

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
        ring-1 ring-inset ${TONES[status] || TONES.DRAFT}`}
    >
      {label}
    </span>
  );
}
