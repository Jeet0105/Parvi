import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import useAuth from '../hooks/useAuth';
import Alert from '../components/Alert';
import Button from '../components/Button';
import FormField from '../components/FormField';
import { homePathForRole } from '../utils/roles';

const EMPTY = { name: '', email: '', mobile: '', password: '' };

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
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
      const user = await register(form);
      navigate(homePathForRole(user.role), { replace: true });
    } catch (error) {
      setFieldErrors(error.fieldErrors || {});
      // A 422 already shows per-field messages; avoid a redundant banner.
      if (error.status !== 422) setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Create your account</h2>
      <p className="mt-1 text-sm text-slate-600">
        Register as a citizen to create and manage your family record.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}

        <FormField
          label="Full name"
          name="name"
          value={form.name}
          onChange={handleChange}
          error={fieldErrors.name}
          autoComplete="name"
          required
        />

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
          label="Mobile number"
          name="mobile"
          type="tel"
          value={form.mobile}
          onChange={handleChange}
          error={fieldErrors.mobile}
          hint="10 digits, starting with 6 to 9"
          autoComplete="tel"
          required
        />

        <FormField
          label="Password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          error={fieldErrors.password}
          hint="At least 8 characters, including a letter and a number"
          autoComplete="new-password"
          required
        />

        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? 'Creating account' : 'Create account'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
