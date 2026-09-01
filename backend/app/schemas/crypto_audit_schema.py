"""Cryptographic Audit Log Schema Validation"""

def validate_audit_log_payload(data: dict):
    """Validate payload for appending a cryptographic audit log record"""
    if not isinstance(data, dict):
        return None, "Invalid JSON payload"

    action = str(data.get('action', '')).strip().upper()
    if not action:
        return None, "action field is required"

    entity_type = str(data.get('entity_type', '')).strip().upper()
    if not entity_type:
        return None, "entity_type field is required"

    entity_id = str(data.get('entity_id', '')).strip()
    if not entity_id:
        return None, "entity_id field is required"

    cleaned = {
        'action': action,
        'entity_type': entity_type,
        'entity_id': entity_id,
        'payload': data.get('payload', {}) if isinstance(data.get('payload'), dict) else {},
        'actor_email': str(data.get('actor_email', 'system@itims.local')).strip(),
        'client_ip': str(data.get('client_ip', '127.0.0.1')).strip(),
        'user_agent': str(data.get('user_agent', 'ITIMS-Core')).strip()
    }

    return cleaned, None

def validate_certificate_request(data: dict):
    """Validate compliance certificate request payload"""
    if not isinstance(data, dict):
        data = {}
    auditor = str(data.get('auditor_name', 'Enterprise Compliance Officer')).strip() or 'Enterprise Compliance Officer'
    return {'auditor_name': auditor}, None
