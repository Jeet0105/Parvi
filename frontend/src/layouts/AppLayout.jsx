import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import useAuth from '../hooks/useAuth';
import Button from '../components/Button';
import { OFFICER_ROLES, ROLES, roleLabel } from '../utils/roles';

const CITIZEN_NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/family', label: 'My Family' },
];

const OFFICER_NAV = [{ to: '/officer', label: 'Verification Queue' }];

export default function AppLayout() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const links = role === ROLES.CITIZEN ? CITIZEN_NAV : OFFICER_NAV;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <span className="text-sm font-bold tracking-tight text-brand-700">
            Family Identity Platform
          </span>

          <nav className="flex gap-1" aria-label="Main">
            {links.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{user?.name}</p>
              <p className="text-xs text-slate-500">{roleLabel(role)}</p>
            </div>
            <Button variant="secondary" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-3">
        <p className="mx-auto max-w-6xl text-xs text-slate-500">
          Prototype using synthetic data only. No real identity records.
        </p>
      </footer>
    </div>
  );
}

export { CITIZEN_NAV, OFFICER_NAV, OFFICER_ROLES };
