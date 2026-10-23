export const VALID_DEPRECIATION_METHODS = new Set(['straight_line', 'double_declining', 'none']);

export const sanitizeString = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const cleaned = val.trim();
    return cleaned.length > 0 ? cleaned : null;
  }
  return String(val);
};

export const sanitizeCost = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
};

export const validateAssetPayload = (data, isUpdate = false) => {
  if (!data || typeof data !== 'object') {
    return { cleaned: null, error: 'Invalid request body; expected JSON object' };
  }

  if (!isUpdate) {
    const requiredFields = ['name', 'type', 'status'];
    for (const field of requiredFields) {
      const val = data[field];
      if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
        return { cleaned: null, error: `Missing required field: ${field}` };
      }
    }
  }

  const cleaned = {};

  if ('name' in data) cleaned.name = sanitizeString(data.name);
  if ('type' in data) cleaned.type = sanitizeString(data.type);
  if ('status' in data) cleaned.status = sanitizeString(data.status);
  if ('description' in data) cleaned.description = sanitizeString(data.description);
  if ('serial_number' in data) cleaned.serial_number = sanitizeString(data.serial_number);
  if ('location' in data) cleaned.location = sanitizeString(data.location);
  if ('purchase_date' in data) cleaned.purchase_date = sanitizeString(data.purchase_date);
  if ('warranty_expiry' in data) cleaned.warranty_expiry = sanitizeString(data.warranty_expiry);
  if ('cost' in data) cleaned.cost = sanitizeCost(data.cost);
  if ('assigned_to' in data) cleaned.assigned_to = sanitizeString(data.assigned_to);
  if ('department_id' in data) cleaned.department_id = sanitizeString(data.department_id);
  if ('salvage_value' in data) cleaned.salvage_value = sanitizeCost(data.salvage_value) ?? 0.00;
  if ('useful_life_years' in data) {
    const parsed = parseInt(data.useful_life_years, 10);
    cleaned.useful_life_years = isNaN(parsed) ? 5 : Math.max(1, parsed);
  }
  if ('depreciation_method' in data) {
    const method = data.depreciation_method ? String(data.depreciation_method).trim().toLowerCase() : 'straight_line';
    cleaned.depreciation_method = VALID_DEPRECIATION_METHODS.has(method) ? method : 'straight_line';
  }

  return { cleaned, error: null };
};
