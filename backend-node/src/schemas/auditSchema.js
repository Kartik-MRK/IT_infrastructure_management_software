/**
 * Physical Asset Audit Schema Validation
 */

export const VALID_PHYSICAL_CONDITIONS = new Set(['excellent', 'good', 'fair', 'poor', 'damaged']);
export const VALID_SCAN_METHODS = new Set(['camera_qr', 'handheld_scanner', 'manual_tag_input']);

/**
 * Validate payload for recording a physical asset audit
 */
export function validateAuditPayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { data: null, error: 'Invalid JSON payload' };
  }

  const condition = String(data.physical_condition || 'good').trim().toLowerCase();
  if (!VALID_PHYSICAL_CONDITIONS.has(condition)) {
    return {
      data: null,
      error: `Invalid physical_condition '${condition}'. Must be one of: ${Array.from(VALID_PHYSICAL_CONDITIONS).sort().join(', ')}`,
    };
  }

  const scanMethod = String(data.scan_method || 'camera_qr').trim().toLowerCase();
  if (!VALID_SCAN_METHODS.has(scanMethod)) {
    return {
      data: null,
      error: `Invalid scan_method '${scanMethod}'. Must be one of: ${Array.from(VALID_SCAN_METHODS).sort().join(', ')}`,
    };
  }

  const cleaned = {
    physical_condition: condition,
    scan_method: scanMethod,
    location_verified: data.location_verified !== undefined ? Boolean(data.location_verified) : true,
    status_verified: data.status_verified !== undefined ? Boolean(data.status_verified) : true,
    observed_location: data.observed_location ? String(data.observed_location).trim() : null,
    observed_status: data.observed_status ? String(data.observed_status).trim() : null,
    notes: data.notes ? String(data.notes).trim() : null,
  };

  return { data: cleaned, error: null };
}
