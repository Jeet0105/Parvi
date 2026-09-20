import useAuth from '../hooks/useAuth';
import { roleLabel } from '../utils/roles';

export default function OfficerDashboardPage() {
  const { user, role } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Verification dashboard
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Signed in as {user?.name} ({roleLabel(role)}).
        </p>
      </div>

      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm font-medium text-slate-700">
          No pending verification requests.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          The verification queue arrives in a later build phase.
        </p>
      </section>
    </div>
  );
}
