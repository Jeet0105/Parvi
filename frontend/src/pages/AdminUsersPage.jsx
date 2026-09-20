import { useCallback, useEffect, useState } from 'react';

import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import useAuth from '../hooks/useAuth';
import * as userApi from '../services/user.service';
import { ROLES, roleLabel } from '../utils/roles';

const ROLE_OPTIONS = Object.values(ROLES);

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await userApi.listUsers({
        role: roleFilter || undefined,
      });
      setUsers(response.data.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRoleChange = async (id, role) => {
    setSavingId(id);
    setError('');
    setNotice('');
    try {
      const response = await userApi.updateUserRole(id, role);
      const updated = response.data.user;
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      setNotice(`${updated.name} is now a ${roleLabel(updated.role)}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">User management</h2>
        <p className="mt-1 text-sm text-slate-600">
          Assign roles to citizens and government officers.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <label htmlFor="role-filter" className="text-sm font-medium text-slate-700">
          Filter by role
        </label>
        <select
          id="role-filter"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </select>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {loading ? (
        <Spinner label="Loading users" />
      ) : users.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          No users match this filter.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Platform users and their roles</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                <th scope="col" className="px-4 py-3 font-semibold">Email</th>
                <th scope="col" className="px-4 py-3 font-semibold">District</th>
                <th scope="col" className="px-4 py-3 font-semibold">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const isSelf = user.id === currentUser?.id;
                return (
                  <tr key={user.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {user.name}
                      {isSelf && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                          you
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                    <td className="px-4 py-3 text-slate-600">{user.district || '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Role for ${user.name}`}
                        value={user.role}
                        disabled={isSelf || savingId === user.id}
                        onChange={(event) =>
                          handleRoleChange(user.id, event.target.value)
                        }
                        className="rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {roleLabel(role)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
