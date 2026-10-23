/**
 * Schema validation for SLA Policies, Timers, and Incident Acknowledgment
 */

export const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);

/**
 * Validate payload for creating or updating an SLA policy
 */
export function validateSlaPolicyPayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { data: null, error: 'Request body must be a JSON object' };
  }

  const cleaned = {};

  if ('policy_name' in data) {
    if (typeof data.policy_name !== 'string' || !data.policy_name.trim()) {
      return { data: null, error: 'policy_name must be a non-empty string' };
    }
    cleaned.policy_name = data.policy_name.trim();
  }

  if ('severity' in data) {
    const sev = String(data.severity).toLowerCase().trim();
    if (!VALID_SEVERITIES.has(sev)) {
      return {
        data: null,
        error: `Invalid severity: '${sev}'. Must be one of: ${Array.from(VALID_SEVERITIES).sort().join(', ')}`,
      };
    }
    cleaned.severity = sev;
  }

  if ('max_response_time_minutes' in data) {
    const respMin = parseInt(data.max_response_time_minutes, 10);
    if (isNaN(respMin)) {
      return { data: null, error: 'max_response_time_minutes must be an integer' };
    }
    if (respMin <= 0) {
      return { data: null, error: 'max_response_time_minutes must be greater than 0' };
    }
    cleaned.max_response_time_minutes = respMin;
  }

  if ('max_resolution_time_minutes' in data) {
    const resMin = parseInt(data.max_resolution_time_minutes, 10);
    if (isNaN(resMin)) {
      return { data: null, error: 'max_resolution_time_minutes must be an integer' };
    }
    if (resMin <= 0) {
      return { data: null, error: 'max_resolution_time_minutes must be greater than 0' };
    }
    cleaned.max_resolution_time_minutes = resMin;
  }

  if ('business_hours_only' in data) {
    cleaned.business_hours_only = Boolean(data.business_hours_only);
  }

  if ('escalation_email' in data) {
    if (data.escalation_email !== null && typeof data.escalation_email !== 'string') {
      return { data: null, error: 'escalation_email must be a string or null' };
    }
    cleaned.escalation_email = data.escalation_email ? String(data.escalation_email).trim() : null;
  }

  if ('is_active' in data) {
    cleaned.is_active = Boolean(data.is_active);
  }

  return { data: cleaned, error: null };
}
