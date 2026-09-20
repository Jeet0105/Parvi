import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold tracking-tight text-brand-700">
            Family Identity Platform
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Verified family identity for government services
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <Outlet />
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Prototype using synthetic data only. Do not enter real identity details.
        </p>
      </div>
    </div>
  );
}
