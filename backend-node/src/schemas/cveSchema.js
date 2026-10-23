/**
 * CVE Vulnerability Scanner Schema Validation
 */

export const VALID_VULN_STATUSES = new Set(['open', 'in_remediation', 'resolved', 'false_positive']);

/**
 * Validate vulnerability resolution status payload
 */
export function validateVulnStatusPayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { data: null, error: 'Invalid JSON payload' };
  }

  const status = String(data.status || '').trim().toLowerCase();
  if (!status) {
    return { data: null, error: 'Status field is required' };
  }

  if (!VALID_VULN_STATUSES.has(status)) {
    return {
      data: null,
      error: `Invalid status '${status}'. Must be one of: ${Array.from(VALID_VULN_STATUSES).sort().join(', ')}`,
    };
  }

  const cleaned = { status };
  if ('resolution_notes' in data) {
    cleaned.resolution_notes = String(data.resolution_notes).trim();
  }

  return { data: cleaned, error: null };
}
