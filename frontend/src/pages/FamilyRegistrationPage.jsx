import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Alert from '../components/Alert';
import Button from '../components/Button';
import FormField from '../components/FormField';
import useAuth from '../hooks/useAuth';
import * as familyApi from '../services/family.service';

const EMPTY = {
  state: 'Gujarat',
  district: '',
  taluka: '',
  village: '',
  address: '',
  annualIncome: '',
  ownsHouse: false,
  headName: '',
  headDateOfBirth: '',
  headGender: '',
  fatherName: '',
  motherName: '',
};

export default function FamilyRegistrationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ ...EMPTY, headName: user?.name || '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  /** The API nests head fields, so flat form state is mapped back on submit. */
  const buildPayload = () => ({
    state: form.state,
    district: form.district,
    taluka: form.taluka,
    village: form.village,
    address: form.address,
    ...(form.annualIncome !== '' ? { annualIncome: Number(form.annualIncome) } : {}),
    ownsHouse: form.ownsHouse,
    head: {
      name: form.headName || undefined,
      dateOfBirth: form.headDateOfBirth,
      gender: form.headGender,
      ...(form.fatherName ? { fatherName: form.fatherName } : {}),
      ...(form.motherName ? { motherName: form.motherName } : {}),
    },
  });

  /** Maps `head.dateOfBirth` style paths back onto the flat form fields. */
  const mapApiErrors = (errors) => {
    const mapping = {
      'head.name': 'headName',
      'head.dateOfBirth': 'headDateOfBirth',
      'head.gender': 'headGender',
      'head.fatherName': 'fatherName',
      'head.motherName': 'motherName',
      head: 'headDateOfBirth',
    };
    return Object.fromEntries(
      errors.map(({ field, message }) => [mapping[field] || field, message])
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setFieldErrors({});
    setSubmitting(true);

    try {
      const response = await familyApi.createFamily(buildPayload());
      navigate('/family', {
        replace: true,
        state: { justCreated: response.data.family.familyId },
      });
    } catch (error) {
      setFieldErrors(mapApiErrors(error.errors || []));
      if (error.status !== 422) setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-xl font-semibold text-slate-900">Register your family</h2>
      <p className="mt-1 text-sm text-slate-600">
        You will receive a unique Family ID. It stays with your family even if
        you move, and never contains Aadhaar or other identity numbers.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-8">
        {formError && <Alert tone="error">{formError}</Alert>}

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900">
            Family Head
          </legend>

          <FormField
            label="Full name"
            name="headName"
            value={form.headName}
            onChange={handleChange}
            error={fieldErrors.headName}
            hint="Defaults to your account name"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Date of birth"
              name="headDateOfBirth"
              type="date"
              value={form.headDateOfBirth}
              onChange={handleChange}
              error={fieldErrors.headDateOfBirth}
              required
            />

            <div className="space-y-1.5">
              <label
                htmlFor="headGender"
                className="block text-sm font-medium text-slate-700"
              >
                Gender<span className="ml-0.5 text-red-600">*</span>
              </label>
              <select
                id="headGender"
                name="headGender"
                value={form.headGender}
                onChange={handleChange}
                aria-invalid={fieldErrors.headGender ? 'true' : undefined}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm"
              >
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
              {fieldErrors.headGender && (
                <p role="alert" className="text-xs font-medium text-red-600">
                  {fieldErrors.headGender}
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
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900">Location</legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="State"
              name="state"
              value={form.state}
              onChange={handleChange}
              error={fieldErrors.state}
              required
            />
            <FormField
              label="District"
              name="district"
              value={form.district}
              onChange={handleChange}
              error={fieldErrors.district}
              required
            />
            <FormField
              label="Taluka"
              name="taluka"
              value={form.taluka}
              onChange={handleChange}
              error={fieldErrors.taluka}
              required
            />
            <FormField
              label="Village or ward"
              name="village"
              value={form.village}
              onChange={handleChange}
              error={fieldErrors.village}
              required
            />
          </div>

          <FormField
            label="Address"
            name="address"
            value={form.address}
            onChange={handleChange}
            error={fieldErrors.address}
            required
          />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900">
            Scheme eligibility
          </legend>
          <p className="text-xs text-slate-500">
            Optional. Used to suggest government schemes your family may qualify for.
          </p>

          <FormField
            label="Annual household income"
            name="annualIncome"
            type="number"
            min="0"
            value={form.annualIncome}
            onChange={handleChange}
            error={fieldErrors.annualIncome}
          />

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="ownsHouse"
              checked={form.ownsHouse}
              onChange={handleChange}
              className="size-4 rounded border-slate-300"
            />
            The family owns a house
          </label>
        </fieldset>

        <Button type="submit" loading={submitting}>
          {submitting ? 'Registering' : 'Register family'}
        </Button>
      </form>
    </div>
  );
}
