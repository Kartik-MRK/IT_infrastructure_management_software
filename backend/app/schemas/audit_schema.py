"""Physical Asset Audit Schema Validation"""

VALID_PHYSICAL_CONDITIONS = {'excellent', 'good', 'fair', 'poor', 'damaged'}
VALID_SCAN_METHODS = {'camera_qr', 'handheld_scanner', 'manual_tag_input'}

def validate_audit_payload(data: dict):
    """Validate payload for recording a physical asset audit"""
    if not isinstance(data, dict):
        return None, "Invalid JSON payload"

    condition = str(data.get('physical_condition', 'good')).strip().lower()
    if condition not in VALID_PHYSICAL_CONDITIONS:
        return None, f"Invalid physical_condition '{condition}'. Must be one of: {', '.join(sorted(VALID_PHYSICAL_CONDITIONS))}"

    scan_method = str(data.get('scan_method', 'camera_qr')).strip().lower()
    if scan_method not in VALID_SCAN_METHODS:
        return None, f"Invalid scan_method '{scan_method}'. Must be one of: {', '.join(sorted(VALID_SCAN_METHODS))}"

    cleaned = {
        'physical_condition': condition,
        'scan_method': scan_method,
        'location_verified': bool(data.get('location_verified', True)),
        'status_verified': bool(data.get('status_verified', True)),
        'observed_location': str(data.get('observed_location', '')).strip() if data.get('observed_location') else None,
        'observed_status': str(data.get('observed_status', '')).strip() if data.get('observed_status') else None,
        'notes': str(data.get('notes', '')).strip() if data.get('notes') else None
    }

    return cleaned, None
