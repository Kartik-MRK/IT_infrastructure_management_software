"""Software License Validation Schemas"""

from datetime import datetime

VALID_LICENSE_TYPES = {'per_seat', 'site_license', 'per_core', 'subscription', 'open_source', 'oem'}

def validate_license_data(data, is_update=False):
    """Validate software license creation/update payloads"""
    if not isinstance(data, dict):
        return None, "Invalid request body format (expected JSON object)"
        
    cleaned = {}
    
    # Required for creation
    if not is_update:
        if not data.get('software_asset_id'):
            return None, "software_asset_id is required"
        if not data.get('license_name') or not str(data['license_name']).strip():
            return None, "license_name is required"
            
    if 'software_asset_id' in data:
        cleaned['software_asset_id'] = str(data['software_asset_id']).strip()
        
    if 'license_name' in data:
        cleaned['license_name'] = str(data['license_name']).strip()
        
    if 'license_key' in data:
        cleaned['license_key'] = str(data['license_key']).strip() if data['license_key'] else None
        
    if 'license_type' in data:
        ltype = str(data['license_type']).strip().lower()
        if ltype not in VALID_LICENSE_TYPES:
            return None, f"Invalid license_type. Must be one of: {', '.join(sorted(VALID_LICENSE_TYPES))}"
        cleaned['license_type'] = ltype
    elif not is_update:
        cleaned['license_type'] = 'per_seat'
        
    if 'total_seats' in data:
        try:
            seats = int(data['total_seats'])
            if seats < 0:
                return None, "total_seats must be greater than or equal to 0"
            cleaned['total_seats'] = seats
        except (ValueError, TypeError):
            return None, "total_seats must be a valid integer"
    elif not is_update:
        cleaned['total_seats'] = 1
        
    if 'cost_per_seat' in data:
        try:
            cleaned['cost_per_seat'] = float(data['cost_per_seat']) if data['cost_per_seat'] is not None else 0.00
        except (ValueError, TypeError):
            return None, "cost_per_seat must be a numeric value"
            
    if 'purchase_date' in data:
        pdate = data['purchase_date']
        if pdate:
            try:
                datetime.strptime(str(pdate).strip()[:10], '%Y-%m-%d')
                cleaned['purchase_date'] = str(pdate).strip()[:10]
            except ValueError:
                return None, "purchase_date must be formatted as YYYY-MM-DD"
        else:
            cleaned['purchase_date'] = None
            
    if 'expiration_date' in data:
        edate = data['expiration_date']
        if edate:
            try:
                datetime.strptime(str(edate).strip()[:10], '%Y-%m-%d')
                cleaned['expiration_date'] = str(edate).strip()[:10]
            except ValueError:
                return None, "expiration_date must be formatted as YYYY-MM-DD"
        else:
            cleaned['expiration_date'] = None
            
    if 'vendor' in data:
        cleaned['vendor'] = str(data['vendor']).strip() if data['vendor'] else None
        
    if 'department_id' in data:
        cleaned['department_id'] = str(data['department_id']).strip() if data['department_id'] else None
        
    return cleaned, None

def validate_allocation_data(data):
    """Validate license seat allocation payload"""
    if not isinstance(data, dict):
        return None, "Invalid request body format (expected JSON object)"
        
    asset_id = data.get('allocated_to_asset_id')
    user_id = data.get('allocated_to_user_id')
    
    if not asset_id and not user_id:
        return None, "Seat must be allocated to either an asset (allocated_to_asset_id) or a user (allocated_to_user_id)"
        
    cleaned = {
        'allocated_to_asset_id': str(asset_id).strip() if asset_id else None,
        'allocated_to_user_id': str(user_id).strip() if user_id else None,
        'notes': str(data.get('notes', '')).strip() if data.get('notes') else None
    }
    
    return cleaned, None
