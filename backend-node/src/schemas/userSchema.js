import { z } from 'zod';

export const VALID_ROLES = new Set([
  'it_admin',
  'security_auditor',
  'infrastructure_engineer',
  'helpdesk_operator',
  'asset_custodian',
  'financial_auditor',
  'employee_requester',
  'admin',
  'operator',
  'viewer',
]);

export const VALID_GENDERS = new Set(['male', 'female', 'other', 'prefer_not_to_say']);

export const validateUserRole = (role) => {
  if (!role || typeof role !== 'string') {
    return { role: null, error: `Invalid role. Must be one of: ${Array.from(VALID_ROLES).sort().join(', ')}` };
  }
  const cleanRole = role.trim().toLowerCase();
  if (!VALID_ROLES.has(cleanRole)) {
    return { role: null, error: `Invalid role. Must be one of: ${Array.from(VALID_ROLES).sort().join(', ')}` };
  }
  return { role: cleanRole, error: null };
};

export const validateProfileUpdate = (data) => {
  if (!data || typeof data !== 'object') {
    return { cleaned: null, error: 'Invalid request body' };
  }

  const cleaned = {};
  if ('full_name' in data) {
    cleaned.full_name = data.full_name ? String(data.full_name).trim() : null;
  }
  if ('gender' in data) {
    const g = data.gender ? String(data.gender).trim().toLowerCase() : null;
    if (g && !VALID_GENDERS.has(g)) {
      return { cleaned: null, error: `Invalid gender. Must be one of: ${Array.from(VALID_GENDERS).join(', ')}` };
    }
    cleaned.gender = g;
  }
  if ('employee_id' in data) {
    cleaned.employee_id = data.employee_id ? String(data.employee_id).trim() : null;
  }
  if ('phone_number' in data) {
    cleaned.phone_number = data.phone_number ? String(data.phone_number).trim() : null;
  }
  if ('department_id' in data) {
    cleaned.department_id = data.department_id ? String(data.department_id).trim() : null;
  }

  return { cleaned, error: null };
};

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().optional(),
  gender: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
