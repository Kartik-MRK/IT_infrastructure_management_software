"""Incident Repository for Database Access"""

from ..core.database import get_supabase

class IncidentRepository:
    """Encapsulates all database queries on incidents table"""
    
    @staticmethod
    def get_all(status_filter=None, severity_filter=None, asset_id_filter=None):
        supabase = get_supabase()
        query = supabase.table('incidents').select('''
            *,
            reporter:reported_by(id, email, full_name),
            assignee:assigned_to(id, email, full_name),
            resolver:resolved_by(id, email, full_name),
            asset:asset_id(id, name, type)
        ''')
        
        if status_filter:
            query = query.eq('status', status_filter)
        if severity_filter:
            query = query.eq('severity', severity_filter)
        if asset_id_filter:
            query = query.eq('asset_id', asset_id_filter)
            
        return query.order('priority', desc=True).order('created_at', desc=True).execute()
        
    @staticmethod
    def get_by_id(incident_id):
        supabase = get_supabase()
        return supabase.table('incidents').select('''
            *,
            reporter:reported_by(id, email, full_name),
            assignee:assigned_to(id, email, full_name),
            resolver:resolved_by(id, email, full_name),
            asset:asset_id(id, name, type, status, location)
        ''').eq('id', incident_id).single().execute()
        
    @staticmethod
    def create(incident_data):
        supabase = get_supabase()
        return supabase.table('incidents').insert(incident_data).execute()
        
    @staticmethod
    def update(incident_id, update_data):
        supabase = get_supabase()
        return supabase.table('incidents').update(update_data).eq('id', incident_id).execute()
        
    @staticmethod
    def delete(incident_id):
        supabase = get_supabase()
        return supabase.table('incidents').delete().eq('id', incident_id).execute()
        
    @staticmethod
    def get_summary_counts():
        supabase = get_supabase()
        try:
            res = supabase.table('incidents').select('status, severity').execute()
            data = res.data or []
            open_count = sum(1 for inc in data if inc.get('status') == 'open')
            critical_count = sum(1 for inc in data if inc.get('severity') == 'critical' and inc.get('status') != 'resolved')
            return open_count, critical_count
        except Exception:
            return 0, 0

    @staticmethod
    def get_recent(limit=5):
        supabase = get_supabase()
        return supabase.table('incidents').select('''
            id, title, severity, status, created_at,
            reporter:reported_by(full_name, email),
            asset:asset_id(name)
        ''').order('created_at', desc=True).limit(limit).execute()
