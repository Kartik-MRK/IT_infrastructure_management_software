"""Physical Audit Repository for Database Access"""

from ..core.database import get_supabase

class AuditRepository:
    """Encapsulates all database operations and stored RPC queries for physical asset audits"""

    @staticmethod
    def record_audit(asset_id, auditor_id, audit_data):
        """Invoke PostgreSQL record_asset_physical_audit stored procedure"""
        supabase = get_supabase()
        try:
            rpc_res = supabase.rpc('record_asset_physical_audit', {
                'p_asset_id': str(asset_id),
                'p_auditor_id': str(auditor_id),
                'p_location_verified': audit_data.get('location_verified', True),
                'p_observed_location': audit_data.get('observed_location'),
                'p_status_verified': audit_data.get('status_verified', True),
                'p_observed_status': audit_data.get('observed_status'),
                'p_physical_condition': audit_data.get('physical_condition', 'good'),
                'p_scan_method': audit_data.get('scan_method', 'camera_qr'),
                'p_notes': audit_data.get('notes')
            }).execute()
            return rpc_res.data
        except Exception as e:
            print(f"⚠️ record_asset_physical_audit RPC error: {e}")
            raise e

    @staticmethod
    def get_asset_audits(asset_id):
        """Fetch chronological physical audit history for an asset"""
        supabase = get_supabase()
        return supabase.table('asset_audits').select('''
            id, audited_at, location_verified, observed_location,
            status_verified, observed_status, physical_condition,
            scan_method, notes, created_at,
            auditor:auditor_id(id, email, full_name, role)
        ''').eq('asset_id', asset_id).order('audited_at', desc=True).execute()

    @staticmethod
    def get_recent_audits(limit=20):
        """Fetch global feed of recent physical audits"""
        supabase = get_supabase()
        return supabase.table('asset_audits').select('''
            id, audited_at, location_verified, observed_location,
            status_verified, observed_status, physical_condition,
            scan_method, notes,
            asset:asset_id(id, name, type, status, location),
            auditor:auditor_id(id, email, full_name, role)
        ''').order('audited_at', desc=True).limit(limit).execute()

    @staticmethod
    def get_summary():
        """Invoke PostgreSQL get_physical_audit_summary stored procedure"""
        supabase = get_supabase()
        try:
            rpc_res = supabase.rpc('get_physical_audit_summary').execute()
            if rpc_res.data:
                if isinstance(rpc_res.data, list) and len(rpc_res.data) > 0:
                    first = rpc_res.data[0]
                    if isinstance(first, dict) and 'get_physical_audit_summary' in first:
                        return first['get_physical_audit_summary']
                    return first
                return rpc_res.data
            return None
        except Exception as e:
            print(f"⚠️ get_physical_audit_summary RPC error: {e}")
            return None
