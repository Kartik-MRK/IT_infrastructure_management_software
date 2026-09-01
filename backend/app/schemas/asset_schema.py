"""Asset Validation and Parsing Schemas"""

VALID_DEPRECIATION_METHODS = {'straight_line', 'double_declining', 'none'}

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
    if 'department_id' in data:
        cleaned['department_id'] = sanitize_string(data['department_id'])
    if 'salvage_value' in data:
        cleaned['salvage_value'] = sanitize_cost(data['salvage_value']) or 0.00
    if 'useful_life_years' in data:
        try:
            cleaned['useful_life_years'] = max(1, int(data['useful_life_years'])) if data['useful_life_years'] else 5
        except (ValueError, TypeError):
            cleaned['useful_life_years'] = 5
    if 'depreciation_method' in data:
        method = str(data['depreciation_method']).strip().lower() if data['depreciation_method'] else 'straight_line'
        cleaned['depreciation_method'] = method if method in VALID_DEPRECIATION_METHODS else 'straight_line'

    return cleaned, None
