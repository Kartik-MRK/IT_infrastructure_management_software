"""Incident Validation and Parsing Schemas"""

VALID_SEVERITIES = {'low', 'medium', 'high', 'critical'}
VALID_STATUSES = {'open', 'in_progress', 'resolved', 'closed'}

def sanitize_string(val):
    """Safely sanitize string, returning stripped non-empty string or None"""
    if val is None:
        return None
    if isinstance(val, str):
        cleaned = val.strip()
        return cleaned if cleaned else None
    return str(val)

def validate_incident_payload(data, is_update=False):
    """
    Validate and sanitize incident payload.
    Returns: (cleaned_dict, error_message_or_None)
    """
    if not isinstance(data, dict):
        return None, "Invalid request body; expected JSON object"
    
    if not is_update:
        if not data.get('title') or not str(data.get('title')).strip():
            return None, "Missing required field: title"
        if not data.get('description') or not str(data.get('description')).strip():
            return None, "Missing required field: description"
        if not data.get('severity') or not str(data.get('severity')).strip():
            return None, "Missing required field: severity"

    severity = data.get('severity')
    if severity is not None:
        sev_str = str(severity).strip().lower()
        if sev_str not in VALID_SEVERITIES:
            return None, f"Invalid severity. Must be one of: {', '.join(VALID_SEVERITIES)}"

    status = data.get('status')
    if status is not None:
        stat_str = str(status).strip().lower()
        if stat_str not in VALID_STATUSES:
            return None, f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}"

    priority = data.get('priority')
    parsed_priority = None
    if priority is not None and priority != '':
        try:
            p_val = int(priority)
            if p_val < 1 or p_val > 10:
                return None, "Priority must be between 1 and 10"
            parsed_priority = p_val
        except (ValueError, TypeError):
            return None, "Priority must be an integer between 1 and 10"

    cleaned = {}
    if 'title' in data:
        cleaned['title'] = sanitize_string(data['title'])
    if 'description' in data:
        cleaned['description'] = sanitize_string(data['description'])
    if 'severity' in data:
        cleaned['severity'] = str(data['severity']).strip().lower()
    if 'status' in data:
        cleaned['status'] = str(data['status']).strip().lower()
    if 'category' in data:
        cleaned['category'] = sanitize_string(data['category'])
    if 'asset_id' in data:
        cleaned['asset_id'] = sanitize_string(data['asset_id'])
    if 'assigned_to' in data:
        cleaned['assigned_to'] = sanitize_string(data['assigned_to'])
    if 'resolution_notes' in data:
        cleaned['resolution_notes'] = sanitize_string(data['resolution_notes'])
    if priority is not None:
        cleaned['priority'] = parsed_priority

    return cleaned, None
