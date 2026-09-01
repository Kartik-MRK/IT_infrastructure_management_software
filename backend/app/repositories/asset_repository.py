"""Asset Repository for Database Access"""

from datetime import datetime, timezone
from ..core.database import get_supabase

class AssetRepository:
    """Encapsulates all database queries on assets and asset_metrics tables"""
    
    @staticmethod
    def get_all(department_id=None, include_deleted=False):
        supabase = get_supabase()
        query = supabase.table('assets').select('''
            *,
            creator:created_by(id, email, full_name),
            assignee:assigned_to(id, email, full_name),
            department:department_id(id, name, code)
        ''')
        if not include_deleted:
            # Only filter if column exists in table (or query gracefully)
            pass
        if department_id:
            query = query.eq('department_id', department_id)
        return query.execute()
        
    @staticmethod
    def get_by_id(asset_id):
        supabase = get_supabase()
        return supabase.table('assets').select('''
            *,
            creator:created_by(id, email, full_name),
            assignee:assigned_to(id, email, full_name),
            department:department_id(id, name, code)
        ''').eq('id', asset_id).single().execute()
        
    @staticmethod
    def create(asset_data):
        supabase = get_supabase()
        return supabase.table('assets').insert(asset_data).execute()
        
    @staticmethod
    def update(asset_id, update_data):
        supabase = get_supabase()
        return supabase.table('assets').update(update_data).eq('id', asset_id).execute()
        
    @staticmethod
    def delete(asset_id):
        supabase = get_supabase()
        return supabase.table('assets').delete().eq('id', asset_id).execute()

    @staticmethod
    def soft_delete(asset_id):
        supabase = get_supabase()
        now_iso = datetime.now(timezone.utc).isoformat()
        return supabase.table('assets').update({
            'deleted_at': now_iso,
            'is_active': False,
            'status': 'retired'
        }).eq('id', asset_id).execute()
        
    @staticmethod
    def get_counts_by_status_and_type():
        supabase = get_supabase()
        total = supabase.table('assets').select('id', count='exact').execute().count or 0
        
        statuses = ['active', 'in_use', 'maintenance', 'retired', 'damaged']
        by_status = {}
        for s in statuses:
            res = supabase.table('assets').select('id', count='exact').eq('status', s).execute()
            by_status[s] = res.count or 0
            
        types = ['hardware', 'software', 'network', 'infrastructure', 'peripherals']
        by_type = {}
        for t in types:
            res = supabase.table('assets').select('id', count='exact').eq('type', t).execute()
            by_type[t] = res.count or 0
            
        return total, by_status, by_type
        
    @staticmethod
    def get_latest_metrics(asset_id):
        supabase = get_supabase()
        return supabase.table('asset_metrics').select('*').eq('asset_id', asset_id).order('last_updated', desc=True).limit(1).execute()
        
    @staticmethod
    def get_critical_metrics(limit=10):
        supabase = get_supabase()
        return supabase.table('asset_metrics').select('''
            *,
            asset:asset_id(id, name, type, status)
        ''').eq('health_status', 'critical').order('last_updated', desc=True).limit(limit).execute()
        
    @staticmethod
    def get_warning_metrics(limit=5):
        supabase = get_supabase()
        return supabase.table('asset_metrics').select('''
            *,
            asset:asset_id(id, name, type, status)
        ''').eq('health_status', 'warning').order('last_updated', desc=True).limit(limit).execute()
        
    @staticmethod
    def get_problematic_assets():
        supabase = get_supabase()
        return supabase.table('assets').select('*').in_('status', ['maintenance', 'damaged']).execute()

    @staticmethod
    def get_recent(limit=5):
        supabase = get_supabase()
        return supabase.table('assets').select('''
            id, name, type, status, created_at,
            creator:created_by(full_name, email)
        ''').order('created_at', desc=True).limit(limit).execute()

    @staticmethod
    def bulk_update_status(asset_ids: list, new_status: str):
        """Batch update status for multiple assets"""
        if not asset_ids:
            return None
        supabase = get_supabase()
        return supabase.table('assets').update({'status': new_status}).in_('id', asset_ids).execute()

    @staticmethod
    def bulk_delete(asset_ids: list):
        """Batch delete multiple assets"""
        if not asset_ids:
            return None
        supabase = get_supabase()
        return supabase.table('assets').delete().in_('id', asset_ids).execute()

