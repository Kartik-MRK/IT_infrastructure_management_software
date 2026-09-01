"""Asset Validation and Parsing Schemas"""

def sanitize_string(val):
    """Safely sanitize string, returning stripped non-empty string or None"""
    if val is None:
        return None
    if isinstance(val, str):
        cleaned = val.strip()
        return cleaned if cleaned else None
    return str(val)

def sanitize_cost(val):
    """Safely parse float cost or return None"""
    if val is None or val == '':
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None

def validate_asset_payload(data, is_update=False):
    """
    Validate and sanitize asset payload.
    Returns: (cleaned_dict, error_message_or_None)
    """
    if not isinstance(data, dict):
        return None, "Invalid request body; expected JSON object"
    
    if not is_update:
        required_fields = ['name', 'type', 'status']
        for field in required_fields:
            val = data.get(field)
            if val is None or (isinstance(val, str) and not val.strip()):
                return None, f"Missing required field: {field}"

    cleaned = {}
    
    if 'name' in data:
        cleaned['name'] = sanitize_string(data['name'])
    if 'type' in data:
        cleaned['type'] = sanitize_string(data['type'])
    if 'status' in data:
        cleaned['status'] = sanitize_string(data['status'])
    if 'description' in data:
        cleaned['description'] = sanitize_string(data['description'])
    if 'serial_number' in data:
        cleaned['serial_number'] = sanitize_string(data['serial_number'])
    if 'location' in data:
        cleaned['location'] = sanitize_string(data['location'])
    if 'purchase_date' in data:
        cleaned['purchase_date'] = sanitize_string(data['purchase_date'])
    if 'warranty_expiry' in data:
        cleaned['warranty_expiry'] = sanitize_string(data['warranty_expiry'])
    if 'cost' in data:
        cleaned['cost'] = sanitize_cost(data['cost'])
    if 'assigned_to' in data:
        cleaned['assigned_to'] = sanitize_string(data['assigned_to'])

    return cleaned, None
