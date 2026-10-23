export const VALID_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
export const VALID_STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed']);

export const sanitizeString = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const cleaned = val.trim();
    return cleaned.length > 0 ? cleaned : null;
  }
  return String(val);
};

export const sanitizeCost = (val) => {
  if (val === null || val === undefined || val === '') return 0.00;
  const c = parseFloat(val);
  return isNaN(c) ? 0.00 : Math.max(0.00, c);
};

export const validateIncidentPayload = (data, isUpdate = false) => {
  if (!data || typeof data !== 'object') {
    return { cleaned: null, error: 'Invalid request body; expected JSON object' };
  }

  if (!isUpdate) {
    if (!data.title || !String(data.title).trim()) {
      return { cleaned: null, error: 'Missing required field: title' };
    }
    if (!data.description || !String(data.description).trim()) {
      return { cleaned: null, error: 'Missing required field: description' };
    }
    if (!data.severity || !String(data.severity).trim()) {
      return { cleaned: null, error: 'Missing required field: severity' };
    }
  }

  if (data.severity !== undefined && data.severity !== null) {
    const sevStr = String(data.severity).trim().toLowerCase();
    if (!VALID_SEVERITIES.has(sevStr)) {
      return { cleaned: null, error: `Invalid severity. Must be one of: ${Array.from(VALID_SEVERITIES).join(', ')}` };
    }
  }

  if (data.status !== undefined && data.status !== null) {
    const statStr = String(data.status).trim().toLowerCase();
    if (!VALID_STATUSES.has(statStr)) {
      return { cleaned: null, error: `Invalid status. Must be one of: ${Array.from(VALID_STATUSES).join(', ')}` };
    }
  }

  let parsedPriority = null;
  if (data.priority !== undefined && data.priority !== null && data.priority !== '') {
    const pVal = parseInt(data.priority, 10);
    if (isNaN(pVal) || pVal < 1 || pVal > 10) {
      return { cleaned: null, error: 'Priority must be an integer between 1 and 10' };
    }
    parsedPriority = pVal;
  }

  const cleaned = {};
  if ('title' in data) cleaned.title = sanitizeString(data.title);
  if ('description' in data) cleaned.description = sanitizeString(data.description);
  if ('severity' in data && data.severity) cleaned.severity = String(data.severity).trim().toLowerCase();
  if ('status' in data && data.status) cleaned.status = String(data.status).trim().toLowerCase();
  if ('category' in data) cleaned.category = sanitizeString(data.category);
  if ('asset_id' in data) cleaned.asset_id = sanitizeString(data.asset_id);
  if ('assigned_to' in data) cleaned.assigned_to = sanitizeString(data.assigned_to);
  if ('resolution_notes' in data) cleaned.resolution_notes = sanitizeString(data.resolution_notes);
  if ('maintenance_cost' in data) cleaned.maintenance_cost = sanitizeCost(data.maintenance_cost);
  if (parsedPriority !== null) cleaned.priority = parsedPriority;

  return { cleaned, error: null };
};
