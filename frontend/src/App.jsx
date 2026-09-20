import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';
import AdminUsersPage from './pages/AdminUsersPage';
import CitizenDashboardPage from './pages/CitizenDashboardPage';
import FamilyDetailPage from './pages/FamilyDetailPage';
import FamilyMembersPage from './pages/FamilyMembersPage';
import DocumentQueuePage from './pages/DocumentQueuePage';
import FamilyDocumentsPage from './pages/FamilyDocumentsPage';
import FamilyQueuePage from './pages/FamilyQueuePage';
import FamilyRelationshipsPage from './pages/FamilyRelationshipsPage';
import VerificationQueuePage from './pages/VerificationQueuePage';
import FamilyRegistrationPage from './pages/FamilyRegistrationPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import OfficerDashboardPage from './pages/OfficerDashboardPage';
import RegisterPage from './pages/RegisterPage';
import useAuth from './hooks/useAuth';
import Spinner from './components/Spinner';
import { OFFICER_ROLES, ROLES, homePathForRole } from './utils/roles';

// React Flow is a large dependency and only the tree needs it, so it is
// split out of the main bundle.
const FamilyTreePage = lazy(() => import('./pages/FamilyTreePage'));

/** Sends visitors to their role's landing page, or to login. */
function RootRedirect() {
  const { isAuthenticated, role, initialising } = useAuth();

  if (initialising) return <Spinner label="Loading" />;
  return (
    <Navigate to={isAuthenticated ? homePathForRole(role) : '/login'} replace />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.CITIZEN]} />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<CitizenDashboardPage />} />
          <Route path="/family" element={<FamilyDetailPage />} />
          <Route path="/family/register" element={<FamilyRegistrationPage />} />
          <Route path="/family/members" element={<FamilyMembersPage />} />
          <Route path="/family/relationships" element={<FamilyRelationshipsPage />} />
          <Route path="/family/documents" element={<FamilyDocumentsPage />} />
          <Route
            path="/family/tree"
            element={
              <Suspense fallback={<Spinner label="Loading family tree" />}>
                <FamilyTreePage />
              </Suspense>
            }
          />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={OFFICER_ROLES} />}>
        <Route element={<AppLayout />}>
          <Route path="/officer" element={<OfficerDashboardPage />} />
          <Route path="/officer/relationships" element={<VerificationQueuePage />} />
          <Route path="/officer/documents" element={<DocumentQueuePage />} />
          <Route path="/officer/families" element={<FamilyQueuePage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
        <Route element={<AppLayout />}>
          <Route path="/admin/users" element={<AdminUsersPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
