"""Software License Repository for Database Access"""

from ..core.database import get_supabase

class LicenseRepository:
    """Encapsulates all database queries on software_licenses and license_allocations tables"""
    
    @staticmethod
    def get_all(software_asset_id=None, department_id=None):
        supabase = get_supabase()
        query = supabase.table('software_licenses').select('''
            *,
            software_asset:software_asset_id(id, name, type, status),
            department:department_id(id, name, code),
            allocations:license_allocations(id, allocated_to_asset_id, allocated_to_user_id, assigned_at)
        ''')
        if software_asset_id:
            query = query.eq('software_asset_id', software_asset_id)
        if department_id:
            query = query.eq('department_id', department_id)
        return query.order('created_at', desc=True).execute()

    @staticmethod
    def get_by_id(license_id):
        supabase = get_supabase()
        return supabase.table('software_licenses').select('''
            *,
            software_asset:software_asset_id(id, name, type, status),
            department:department_id(id, name, code),
            creator:created_by(id, email, full_name),
            allocations:license_allocations(
                id, assigned_at, notes,
                asset:allocated_to_asset_id(id, name, type, status, location),
                user:allocated_to_user_id(id, email, full_name)
            )
        ''').eq('id', license_id).single().execute()

    @staticmethod
    def create(license_data):
        supabase = get_supabase()
        return supabase.table('software_licenses').insert(license_data).execute()

    @staticmethod
    def update(license_id, update_data):
        supabase = get_supabase()
        return supabase.table('software_licenses').update(update_data).eq('id', license_id).execute()

    @staticmethod
    def delete(license_id):
        supabase = get_supabase()
        return supabase.table('software_licenses').delete().eq('id', license_id).execute()

    @staticmethod
    def get_allocations(license_id):
        supabase = get_supabase()
        return supabase.table('license_allocations').select('''
            *,
            asset:allocated_to_asset_id(id, name, type, status, location),
            user:allocated_to_user_id(id, email, full_name)
        ''').eq('license_id', license_id).order('assigned_at', desc=True).execute()

    @staticmethod
    def create_allocation(allocation_data):
        supabase = get_supabase()
        return supabase.table('license_allocations').insert(allocation_data).execute()

    @staticmethod
    def delete_allocation(allocation_id):
        supabase = get_supabase()
        return supabase.table('license_allocations').delete().eq('id', allocation_id).execute()

    @staticmethod
    def get_compliance_summary():
        supabase = get_supabase()
        try:
            rpc_res = supabase.rpc('get_license_compliance_summary').execute()
            return rpc_res.data or []
        except Exception as e:
            print(f"⚠️ get_license_compliance_summary RPC error: {e}")
            return []
