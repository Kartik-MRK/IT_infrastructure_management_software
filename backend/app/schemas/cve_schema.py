"""CVE Vulnerability Scanner Schema Validation"""

VALID_VULN_STATUSES = {'open', 'in_remediation', 'resolved', 'false_positive'}

def validate_vuln_status_payload(data: dict):
    """Validate vulnerability resolution status payload"""
    if not isinstance(data, dict):
        return None, "Invalid JSON payload"

    status = str(data.get('status', '')).strip().lower()
    if not status:
        return None, "Status field is required"

    if status not in VALID_VULN_STATUSES:
        return None, f"Invalid status '{status}'. Must be one of: {', '.join(sorted(VALID_VULN_STATUSES))}"

    cleaned = {'status': status}
    if 'resolution_notes' in data:
        cleaned['resolution_notes'] = str(data['resolution_notes']).strip()

    return cleaned, None
