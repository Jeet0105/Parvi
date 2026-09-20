const { z } = require('zod');

// Indian mobile numbers: 10 digits starting 6-9.
const mobileRegex = /^[6-9]\d{9}$/;

/** A required string whose "missing" message reads like a form error. */
const requiredString = (label) =>
  z.string({ error: (issue) => (issue.input === undefined ? `${label} is required` : `${label} must be text`) });

// Normalise before validating: Zod applies checks in chain order, so a plain
// `z.email().trim()` would reject padded input before it ever gets trimmed.
const emailField = requiredString('Email')
  .trim()
  .toLowerCase()
  .pipe(z.email('Invalid email address'));

const registerSchema = z.object({
  name: requiredString('Name')
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  email: emailField,
  mobile: requiredString('Mobile')
    .trim()
    .regex(mobileRegex, 'Mobile must be a valid 10-digit number'),
  password: requiredString('Password')
    // bcrypt only considers the first 72 bytes of input.
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[a-zA-Z]/, 'Password must contain a letter')
    .regex(/\d/, 'Password must contain a number'),
});

const loginSchema = z.object({
  email: emailField,
  password: requiredString('Password').min(1, 'Password is required'),
});

module.exports = { registerSchema, loginSchema };
