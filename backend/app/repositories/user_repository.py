"""User Repository for Database Access"""

from ..core.database import get_supabase

class UserRepository:
    """Encapsulates database queries on profiles, roles, departments, and audit logs"""
    
    @staticmethod
    def get_all():
        supabase = get_supabase()
        return supabase.table('profiles').select('''
            *,
            department:department_id(id, name, code)
        ''').order('created_at', desc=True).execute()
        
    @staticmethod
    def get_by_id(user_id):
        supabase = get_supabase()
        return supabase.table('profiles').select('''
            *,
            department:department_id(id, name, code)
        ''').eq('id', user_id).single().execute()
        
    @staticmethod
    def update(user_id, update_data):
        supabase = get_supabase()
        return supabase.table('profiles').update(update_data).eq('id', user_id).execute()
        
    @staticmethod
    def delete(user_id):
        supabase = get_supabase()
        return supabase.table('profiles').delete().eq('id', user_id).execute()

    @staticmethod
    def get_roles():
        supabase = get_supabase()
        return supabase.table('roles').select('''
            id, name, description, is_system_role,
            role_permissions(permission_id)
        ''').order('name').execute()

    @staticmethod
    def get_departments():
        supabase = get_supabase()
        return supabase.table('departments').select('*').order('name').execute()

    @staticmethod
    def get_audit_logs(limit=50, table_name=None, record_id=None):
        supabase = get_supabase()
        query = supabase.table('audit_logs').select('''
            id, table_name, record_id, action, old_values, new_values, performed_at,
            performer:performed_by(email, full_name)
        ''')
        if table_name:
            query = query.eq('table_name', table_name)
        if record_id:
            query = query.eq('record_id', record_id)
        return query.order('performed_at', desc=True).limit(limit).execute()
