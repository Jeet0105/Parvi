import { Navigate, Outlet, useLocation } from 'react-router-dom';

import useAuth from '../hooks/useAuth';
import Spinner from './Spinner';
import { homePathForRole } from '../utils/roles';

/**
 * Gate for authenticated routes.
 *
 * This is a navigation convenience only. The backend enforces authentication
 * and role permissions on every request; nothing here is a security boundary.
 */
export default function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, role, initialising } = useAuth();
  const location = useLocation();

  if (initialising) {
    return <Spinner label="Restoring your session" />;
  }

  if (!isAuthenticated) {
    // Remember where they were headed so login can send them back.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={homePathForRole(role)} replace />;
  }

  return <Outlet />;
}
