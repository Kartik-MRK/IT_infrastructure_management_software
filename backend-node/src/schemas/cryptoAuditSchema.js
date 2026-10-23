/**
 * Cryptographic Audit Log Schema Validation
 */

/**
 * Validate payload for appending a cryptographic audit log record
 */
export function validateAuditLogPayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { data: null, error: 'Invalid JSON payload' };
  }

  const action = String(data.action || '').trim().toUpperCase();
  if (!action) {
    return { data: null, error: 'action field is required' };
  }

  const entityType = String(data.entity_type || '').trim().toUpperCase();
  if (!entityType) {
    return { data: null, error: 'entity_type field is required' };
  }

  const entityId = String(data.entity_id || '').trim();
  if (!entityId) {
    return { data: null, error: 'entity_id field is required' };
  }

  const cleaned = {
    action,
    entity_type: entityType,
    entity_id: entityId,
    payload: data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload) ? data.payload : {},
    actor_email: String(data.actor_email || 'system@itims.local').trim(),
    client_ip: String(data.client_ip || '127.0.0.1').trim(),
    user_agent: String(data.user_agent || 'ITIMS-Core').trim(),
  };

  return { data: cleaned, error: null };
}

/**
 * Validate compliance certificate request payload
 */
export function validateCertificateRequest(data) {
  const payload = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const auditor = String(payload.auditor_name || 'Enterprise Compliance Officer').trim() || 'Enterprise Compliance Officer';
  return { data: { auditor_name: auditor }, error: null };
}
