import { useState } from 'react';

import Alert from './Alert';
import Button from './Button';
import FormField from './FormField';

const EMPTY = {
  name: '',
  dateOfBirth: '',
  gender: '',
  fatherName: '',
  motherName: '',
  spouseName: '',
  isStudent: false,
};

/** Trims an ISO timestamp down to the yyyy-mm-dd a date input expects. */
function toDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export default function MemberForm({ member, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState(
    member
      ? {
          name: member.name || '',
          dateOfBirth: toDateInput(member.dateOfBirth),
          gender: member.gender || '',
          fatherName: member.fatherName || '',
          motherName: member.motherName || '',
          spouseName: member.spouseName || '',
          isStudent: Boolean(member.isStudent),
        }
      : EMPTY
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setFieldErrors({});
    setSubmitting(true);

    // Empty optional text fields are omitted rather than sent as "",
    // which the API would reject as too short.
    const payload = {
      name: form.name,
      dateOfBirth: form.dateOfBirth,
      gender: form.gender,
      isStudent: form.isStudent,
      ...(form.fatherName ? { fatherName: form.fatherName } : {}),
      ...(form.motherName ? { motherName: form.motherName } : {}),
      ...(form.spouseName ? { spouseName: form.spouseName } : {}),
    };

    try {
      await onSubmit(payload);
    } catch (error) {
      setFieldErrors(error.fieldErrors || {});
      if (error.status !== 422) setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && <Alert tone="error">{formError}</Alert>}

      <FormField
        label="Full name"
        name="name"
        value={form.name}
        onChange={handleChange}
        error={fieldErrors.name}
        required
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Date of birth"
          name="dateOfBirth"
          type="date"
          value={form.dateOfBirth}
          onChange={handleChange}
          error={fieldErrors.dateOfBirth}
          required
        />

        <div className="space-y-1.5">
          <label htmlFor="member-gender" className="block text-sm font-medium text-slate-700">
            Gender<span className="ml-0.5 text-red-600">*</span>
          </label>
          <select
            id="member-gender"
            name="gender"
            value={form.gender}
            onChange={handleChange}
            aria-invalid={fieldErrors.gender ? 'true' : undefined}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm"
          >
            <option value="">Select</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
          {fieldErrors.gender && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {fieldErrors.gender}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Father's name"
          name="fatherName"
          value={form.fatherName}
          onChange={handleChange}
          error={fieldErrors.fatherName}
        />
        <FormField
          label="Mother's name"
          name="motherName"
          value={form.motherName}
          onChange={handleChange}
          error={fieldErrors.motherName}
        />
      </div>

      <FormField
        label="Spouse's name"
        name="spouseName"
        value={form.spouseName}
        onChange={handleChange}
        error={fieldErrors.spouseName}
      />

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="isStudent"
          checked={form.isStudent}
          onChange={handleChange}
          className="size-4 rounded border-slate-300"
        />
        Currently a student
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
