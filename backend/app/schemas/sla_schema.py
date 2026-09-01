"""Schema validation for SLA Policies, Timers, and Incident Acknowledgment"""

from typing import Dict, Any, Tuple, Optional

VALID_SEVERITIES = {'critical', 'high', 'medium', 'low'}

def validate_sla_policy_payload(data: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Validate payload for creating or updating an SLA policy"""
    if not isinstance(data, dict):
        return None, "Request body must be a JSON object"

    cleaned = {}

    if 'policy_name' in data:
        if not isinstance(data['policy_name'], str) or not data['policy_name'].strip():
            return None, "policy_name must be a non-empty string"
        cleaned['policy_name'] = data['policy_name'].strip()

    if 'severity' in data:
        sev = str(data['severity']).lower().strip()
        if sev not in VALID_SEVERITIES:
            return None, f"Invalid severity: '{sev}'. Must be one of {VALID_SEVERITIES}"
        cleaned['severity'] = sev

    if 'max_response_time_minutes' in data:
        try:
            resp_min = int(data['max_response_time_minutes'])
            if resp_min <= 0:
                return None, "max_response_time_minutes must be greater than 0"
            cleaned['max_response_time_minutes'] = resp_min
        except (ValueError, TypeError):
            return None, "max_response_time_minutes must be an integer"

    if 'max_resolution_time_minutes' in data:
        try:
            res_min = int(data['max_resolution_time_minutes'])
            if res_min <= 0:
                return None, "max_resolution_time_minutes must be greater than 0"
            cleaned['max_resolution_time_minutes'] = res_min
        except (ValueError, TypeError):
            return None, "max_resolution_time_minutes must be an integer"

    if 'business_hours_only' in data:
        cleaned['business_hours_only'] = bool(data['business_hours_only'])

    if 'escalation_email' in data:
        if data['escalation_email'] is not None and not isinstance(data['escalation_email'], str):
            return None, "escalation_email must be a string or null"
        cleaned['escalation_email'] = data['escalation_email'].strip() if data['escalation_email'] else None

    if 'is_active' in data:
        cleaned['is_active'] = bool(data['is_active'])

    return cleaned, None
