import useAuth from '../hooks/useAuth';

export default function CitizenDashboardPage() {
  const { user } = useAuth();

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

      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm font-medium text-slate-700">
          You have not registered a family yet.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Family registration arrives in the next build phase.
        </p>
      </section>
    </div>
  );
}
