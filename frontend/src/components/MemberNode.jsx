import { Handle, Position } from '@xyflow/react';

const VERIFICATION_RING = {
  VERIFIED: 'ring-emerald-300 bg-emerald-50',
  PENDING: 'ring-amber-300 bg-amber-50',
  UNDER_REVIEW: 'ring-blue-300 bg-blue-50',
  REJECTED: 'ring-red-300 bg-red-50',
};

const GENDER_SYMBOL = { MALE: '♂', FEMALE: '♀', OTHER: '•' };

/** One person in the family tree. */
export default function MemberNode({ data }) {
  const inactive = data.status !== 'ACTIVE';

  return (
    <div
      className={`w-[190px] rounded-xl px-3 py-2 shadow-sm ring-2 ${
        VERIFICATION_RING[data.verificationStatus] || 'ring-slate-300 bg-white'
      } ${inactive ? 'opacity-60' : ''}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />

      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-tight text-slate-900">
          {data.name}
        </p>
        <span aria-hidden="true" className="text-sm text-slate-400">
          {GENDER_SYMBOL[data.gender] || ''}
        </span>
      </div>

      <p className="mt-0.5 text-xs text-slate-500">
        {data.age !== null ? `${data.age} years` : 'Age unknown'}
      </p>

      <div className="mt-1.5 flex flex-wrap gap-1">
        {data.isHead && (
          <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            Head
          </span>
        )}
        {inactive && (
          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
            {data.status.charAt(0) + data.status.slice(1).toLowerCase()}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
    </div>
  );
}
