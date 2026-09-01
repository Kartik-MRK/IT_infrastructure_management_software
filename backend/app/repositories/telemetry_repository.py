"""Repository for Telemetry Ingestion, History & Stored Anomaly Functions"""

from ..core.database import get_supabase

class TelemetryRepository:
    """DAO for time-series telemetry storage, outlier detection RPCs, and sparkline queries"""

    @staticmethod
    def ingest_and_evaluate(asset_id: str, data: dict, auto_incident: bool = True):
        """Invoke PostgreSQL ingest_and_evaluate_telemetry stored procedure"""
        supabase = get_supabase()
        rpc_res = supabase.rpc('ingest_and_evaluate_telemetry', {
            'p_asset_id': str(asset_id),
            'p_cpu': float(data['cpu_usage']),
            'p_mem': float(data['memory_usage']),
            'p_disk': float(data['disk_usage']),
            'p_latency': float(data.get('latency_ms', 5.0)),
            'p_error_rate': float(data.get('error_rate_percent', 0.0)),
            'p_bandwidth': float(data.get('bandwidth_usage_mbps', 100.0)),
            'p_auto_incident': auto_incident
        }).execute()
        return rpc_res.data

    @staticmethod
    def get_history(asset_id: str, limit: int = 30):
        """Invoke PostgreSQL get_asset_telemetry_history RPC"""
        supabase = get_supabase()
        res = supabase.rpc('get_asset_telemetry_history', {
            'p_asset_id': str(asset_id),
            'p_limit': int(limit)
        }).execute()
        return res.data or []

    @staticmethod
    def get_system_summary():
        """Invoke PostgreSQL get_system_anomaly_overview RPC"""
        supabase = get_supabase()
        res = supabase.rpc('get_system_anomaly_overview').execute()
        return res.data or {
            'total_telemetry_samples': 0,
            'total_anomalies_detected': 0,
            'affected_assets_count': 0,
            'recent_anomalies': []
        }

    @staticmethod
    def get_active_assets():
        """Fetch list of all active assets for simulation batch runs"""
        supabase = get_supabase()
        res = (
            supabase.table('assets')
            .select('id, name, type, status')
            .eq('is_active', True)
            .execute()
        )
        return res.data or []
