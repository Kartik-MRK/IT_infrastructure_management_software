"""Repository layer for SLA Policies, Timers, and Compliance Analytics"""

from datetime import datetime, timezone
from ..core.database import get_supabase

class SLARepository:
    """Data access object for SLA policies and compliance computation"""

    @staticmethod
    def get_all_policies():
        """Fetch all configured SLA policies ordered by severity hierarchy"""
        supabase = get_supabase()
        return (
            supabase.table('sla_policies')
            .select('*')
            .order('max_response_time_minutes', desc=False)
            .execute()
        )

    @staticmethod
    def get_policy_by_id(policy_id: str):
        """Fetch a specific SLA policy by ID"""
        supabase = get_supabase()
        return (
            supabase.table('sla_policies')
            .select('*')
            .eq('id', policy_id)
            .single()
            .execute()
        )

    @staticmethod
    def get_policy_by_severity(severity: str):
        """Fetch an active SLA policy for a specific severity"""
        supabase = get_supabase()
        return (
            supabase.table('sla_policies')
            .select('*')
            .eq('severity', severity)
            .eq('is_active', True)
            .single()
            .execute()
        )

    @staticmethod
    def update_policy(policy_id: str, data: dict):
        """Update SLA policy parameters"""
        supabase = get_supabase()
        data['updated_at'] = datetime.now(timezone.utc).isoformat()
        return (
            supabase.table('sla_policies')
            .update(data)
            .eq('id', policy_id)
            .execute()
        )

    @staticmethod
    def record_first_response(incident_id: str, responder_id: str):
        """Record initial technician acknowledgment / response on an incident"""
        supabase = get_supabase()
        now_iso = datetime.now(timezone.utc).isoformat()

        # Fetch current incident record
        inc_res = (
            supabase.table('incidents')
            .select('id, response_deadline, first_responded_at, sla_response_breached')
            .eq('id', incident_id)
            .single()
            .execute()
        )
        if not inc_res.data:
            return None, "Incident not found"

        inc = inc_res.data
        if inc.get('first_responded_at'):
            return inc, "Already acknowledged"

        # Check if response SLA is breached
        is_breached = False
        if inc.get('response_deadline'):
            deadline_dt = datetime.fromisoformat(inc['response_deadline'].replace('Z', '+00:00'))
            if datetime.now(timezone.utc) > deadline_dt:
                is_breached = True

        update_payload = {
            'first_responded_at': now_iso,
            'sla_response_breached': is_breached
        }

        updated = (
            supabase.table('incidents')
            .update(update_payload)
            .eq('id', incident_id)
            .execute()
        )
        return updated.data[0] if updated.data else None, None

    @staticmethod
    def get_sla_compliance_summary():
        """Call PostgreSQL stored function to fetch SLA MTTR, MTTD and compliance rates"""
        supabase = get_supabase()
        res = supabase.rpc('get_sla_compliance_summary').execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
        return {
            'total_incidents': 0,
            'resolved_incidents': 0,
            'resolved_within_sla': 0,
            'sla_compliance_percentage': 100.0,
            'active_breached_count': 0,
            'active_approaching_count': 0,
            'avg_mttd_minutes': 0.0,
            'avg_mttr_minutes': 0.0
        }
