import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import useAuth from '../hooks/useAuth';
import Alert from '../components/Alert';
import Button from '../components/Button';
import FormField from '../components/FormField';
import { homePathForRole } from '../utils/roles';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setFieldErrors({});
    setSubmitting(true);

    try {
      const user = await login(form);
      const intended = location.state?.from?.pathname;
      navigate(intended || homePathForRole(user.role), { replace: true });
    } catch (error) {
      setFieldErrors(error.fieldErrors || {});
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Sign in</h2>
      <p className="mt-1 text-sm text-slate-600">
        Access your family record and scheme applications.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}

        <FormField
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          error={fieldErrors.email}
          autoComplete="email"
          required
        />

        <FormField
          label="Password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          error={fieldErrors.password}
          autoComplete="current-password"
          required
        />

        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? 'Signing in' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        No account yet?{' '}
        <Link to="/register" className="font-semibold text-brand-600 hover:underline">
          Register a family
        </Link>
      </p>
    </div>
  );
}
