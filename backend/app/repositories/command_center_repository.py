"""Repository Layer for Executive Analytics & SRE Command Center"""

from ..core.database import get_supabase

class CommandCenterRepository:
    """DAO for multi-pillar executive metrics and SRE telemetry aggregations"""

    @staticmethod
    def get_command_center_metrics():
        """Invoke PostgreSQL stored procedure aggregating health score, SRE reliability, financial TCO, and security posture"""
        supabase = get_supabase()
        res = supabase.rpc('get_executive_command_center_metrics', {}).execute()
        return res.data
