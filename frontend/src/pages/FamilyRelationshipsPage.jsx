import { useCallback, useEffect, useState } from 'react';

import Alert from '../components/Alert';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import * as familyApi from '../services/family.service';
import * as memberApi from '../services/member.service';
import * as relationshipApi from '../services/relationship.service';
import { RELATIONSHIP_TYPES, relationshipLabel } from '../utils/format';

const EMPTY = { fromMemberId: '', relationshipType: '', toMemberId: '' };

export default function FamilyRelationshipsPage() {
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const familyResponse = await familyApi.getMyFamily();
      const loaded = familyResponse.data.family;
      setFamily(loaded);

      if (loaded) {
        const [memberResponse, relationshipResponse] = await Promise.all([
          memberApi.listMembers(loaded.id),
          relationshipApi.listForFamily(loaded.id),
        ]);
        setMembers(memberResponse.data.members);
        setRelationships(relationshipResponse.data.relationships);
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

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const response = await relationshipApi.createRelationship(form);
      setRelationships((prev) => [...prev, response.data.relationship]);
      setAdding(false);
      setForm(EMPTY);
      setNotice('Relationship recorded and sent for verification.');
    } catch (err) {
      // The API explains exactly why a relationship is implausible, so the
      // detail is more useful to the citizen than the generic message.
      setFormError(err.errors?.[0]?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const nameOf = (id) => members.find((m) => m.id === id)?.name || 'Unknown';

  if (loading) return <Spinner label="Loading relationships" />;

  if (!family) {
    return <Alert tone="info">Register your family before adding relationships.</Alert>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Relationships</h2>
          <p className="mt-1 text-sm text-slate-600">
            Each relationship is checked by a verification officer before it
            becomes part of your verified family record.
          </p>
        </div>
        <Button onClick={() => setAdding(true)} disabled={members.length < 2}>
          Add relationship
        </Button>
      </div>

      {members.length < 2 && (
        <Alert tone="info">
          Add at least two family members before recording a relationship.
        </Alert>
      )}

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {relationships.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
          No relationships recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Recorded family relationships</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Relationship</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">Officer note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {relationships.map((rel) => (
                <tr key={rel.id}>
                  <td className="px-4 py-3 text-slate-800">
                    <span className="font-medium">{rel.fromMember.name}</span>
                    <span className="text-slate-500">
                      {' '}is the {relationshipLabel(rel.relationshipType).toLowerCase()} of{' '}
                    </span>
                    <span className="font-medium">{rel.toMember.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={rel.verificationStatus} kind="verification" />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {rel.rejectionReason || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add relationship"
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {formError && <Alert tone="error">{formError}</Alert>}

          <div className="space-y-1.5">
            <label htmlFor="fromMemberId" className="block text-sm font-medium text-slate-700">
              Member
            </label>
            <select
              id="fromMemberId"
              name="fromMemberId"
              value={form.fromMemberId}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select a member</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="relationshipType" className="block text-sm font-medium text-slate-700">
              is the
            </label>
            <select
              id="relationshipType"
              name="relationshipType"
              value={form.relationshipType}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select a relationship</option>
              {RELATIONSHIP_TYPES.map((type) => (
                <option key={type} value={type}>
                  {relationshipLabel(type)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="toMemberId" className="block text-sm font-medium text-slate-700">
              of
            </label>
            <select
              id="toMemberId"
              name="toMemberId"
              value={form.toMemberId}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select a member</option>
              {members
                .filter((member) => member.id !== form.fromMemberId)
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
          </div>

          {form.fromMemberId && form.relationshipType && form.toMemberId && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {nameOf(form.fromMemberId)} is the{' '}
              {relationshipLabel(form.relationshipType).toLowerCase()} of{' '}
              {nameOf(form.toMemberId)}.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Add relationship
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
