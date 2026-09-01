"""User Profile & Enterprise Role Validation Schemas"""

VALID_ROLES = {
    'it_admin',
    'security_auditor',
    'infrastructure_engineer',
    'helpdesk_operator',
    'asset_custodian',
    'financial_auditor',
    'employee_requester',
    'admin',
    'operator',
    'viewer'
}

VALID_GENDERS = {'male', 'female', 'other', 'prefer_not_to_say'}

def validate_user_role(role):
    """Validate user role string"""
    if not role or str(role).strip().lower() not in VALID_ROLES:
        return None, f"Invalid role. Must be one of: {', '.join(sorted(VALID_ROLES))}"
    return str(role).strip().lower(), None

def validate_profile_update(data):
    """Validate profile update fields"""
    if not isinstance(data, dict):
        return None, "Invalid request body"
        
    cleaned = {}
    if 'full_name' in data:
        cleaned['full_name'] = str(data['full_name']).strip() if data['full_name'] else None
    if 'gender' in data:
        g = str(data['gender']).strip().lower() if data['gender'] else None
        if g and g not in VALID_GENDERS:
            return None, f"Invalid gender. Must be one of: {', '.join(VALID_GENDERS)}"
        cleaned['gender'] = g
    if 'employee_id' in data:
        cleaned['employee_id'] = str(data['employee_id']).strip() if data['employee_id'] else None
    if 'phone_number' in data:
        cleaned['phone_number'] = str(data['phone_number']).strip() if data['phone_number'] else None
    if 'department_id' in data:
        cleaned['department_id'] = str(data['department_id']).strip() if data['department_id'] else None
        
    return cleaned, None
