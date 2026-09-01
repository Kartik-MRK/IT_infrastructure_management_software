"""Physical Asset Audit Validation Schema"""

VALID_CONDITIONS = {'excellent', 'good', 'fair', 'damaged', 'missing'}
VALID_SCAN_METHODS = {'camera_qr', 'barcode_128', 'manual', 'nfc'}

def validate_audit_payload(data):
    """
    Validate and sanitize physical audit submission payload.
    Returns: (cleaned_dict, error_message_or_None)
    """
    if not isinstance(data, dict):
        return None, "Invalid request body; expected JSON object"

    cleaned = {}

    # Physical Condition
    condition = str(data.get('physical_condition', 'good')).strip().lower()
    if condition not in VALID_CONDITIONS:
        return None, f"Invalid physical_condition. Must be one of: {', '.join(sorted(VALID_CONDITIONS))}"
    cleaned['physical_condition'] = condition

    # Scan Method
    method = str(data.get('scan_method', 'camera_qr')).strip().lower()
    if method not in VALID_SCAN_METHODS:
        return None, f"Invalid scan_method. Must be one of: {', '.join(sorted(VALID_SCAN_METHODS))}"
    cleaned['scan_method'] = method

    # Verification Booleans
    cleaned['location_verified'] = bool(data.get('location_verified', True))
    cleaned['status_verified'] = bool(data.get('status_verified', True))

    # Observed Strings
    cleaned['observed_location'] = str(data['observed_location']).strip() if data.get('observed_location') else None
    cleaned['observed_status'] = str(data['observed_status']).strip() if data.get('observed_status') else None
    cleaned['notes'] = str(data['notes']).strip() if data.get('notes') else None

    return cleaned, None
