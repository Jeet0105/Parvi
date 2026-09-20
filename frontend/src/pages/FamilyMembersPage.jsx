import { useCallback, useEffect, useState } from 'react';

import Alert from '../components/Alert';
import Button from '../components/Button';
import MemberForm from '../components/MemberForm';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import * as familyApi from '../services/family.service';
import * as memberApi from '../services/member.service';
import { ageFrom, formatDate, memberStatusLabel } from '../utils/format';

const LIFECYCLE_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'DECEASED',
  'MIGRATED',
  'SEPARATED',
];

export default function FamilyMembersPage() {
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const familyResponse = await familyApi.getMyFamily();
      const loaded = familyResponse.data.family;
      setFamily(loaded);

      if (loaded) {
        const memberResponse = await memberApi.listMembers(loaded.id);
        setMembers(memberResponse.data.members);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (payload) => {
    const response = await memberApi.addMember(family.id, payload);
    setMembers((prev) => [...prev, response.data.member]);
    setAdding(false);
    setNotice(`${response.data.member.name} was added to your family.`);
  };

  const handleEdit = async (payload) => {
    const response = await memberApi.updateMember(editing.id, payload);
    const updated = response.data.member;
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    setEditing(null);
    setNotice(`${updated.name} was updated.`);
  };

  const handleStatusChange = async (member, status) => {
    setBusyId(member.id);
    setError('');
    setNotice('');
    try {
      const response = await memberApi.updateMember(member.id, { status });
      const updated = response.data.member;
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setNotice(`${updated.name} is now ${memberStatusLabel(updated.status)}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleMakeHead = async (member) => {
    setBusyId(member.id);
    setError('');
    setNotice('');
    try {
      const response = await memberApi.changeFamilyHead(family.id, member.id);
      setFamily(response.data.family);
      setNotice(`${member.name} is now the Family Head.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Spinner label="Loading members" />;

  if (!family) {
    return (
      <Alert tone="info">
        Register your family before adding members.
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Family members</h2>
          <p className="mt-1 text-sm text-slate-600">
            {family.familyId} · {members.length} member
            {members.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>Add member</Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Members of this family</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Name</th>
              <th scope="col" className="px-4 py-3 font-semibold">Born</th>
              <th scope="col" className="px-4 py-3 font-semibold">Age</th>
              <th scope="col" className="px-4 py-3 font-semibold">Verification</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <th scope="col" className="px-4 py-3 font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((member) => {
              const isHead = member.id === family.familyHeadId;
              const isVerified = member.verificationStatus === 'VERIFIED';

              return (
                <tr key={member.id} className={member.status !== 'ACTIVE' ? 'bg-slate-50/60' : ''}>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {member.name}
                    {isHead && (
                      <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">
                        Head
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(member.dateOfBirth)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {ageFrom(member.dateOfBirth) ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={member.verificationStatus}
                      kind="verification"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Status for ${member.name}`}
                      value={member.status}
                      disabled={busyId === member.id}
                      onChange={(event) =>
                        handleStatusChange(member, event.target.value)
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
                    >
                      {LIFECYCLE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {memberStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {!isHead && member.status === 'ACTIVE' && (
                        <Button
                          variant="secondary"
                          disabled={busyId === member.id}
                          onClick={() => handleMakeHead(member)}
                        >
                          Make head
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        disabled={isVerified}
                        title={
                          isVerified
                            ? 'Verified details cannot be edited'
                            : undefined
                        }
                        onClick={() => setEditing(member)}
                      >
                        Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Members are never deleted. Use the status column to record a death,
        migration or separation so the family history stays intact.
      </p>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add family member">
        <MemberForm
          onSubmit={handleAdd}
          onCancel={() => setAdding(false)}
          submitLabel="Add member"
        />
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.name || 'member'}`}
      >
        <MemberForm
          member={editing}
          onSubmit={handleEdit}
          onCancel={() => setEditing(null)}
          submitLabel="Save changes"
        />
      </Modal>
    </div>
  );
}
