"""Repository Layer for Cryptographic Audit Logs & Hash Chaining Procedures"""

from ..core.database import get_supabase

class CryptoAuditRepository:
    """DAO for cryptographic audit logs, blockchain-style verification, and certificate generation"""

    @staticmethod
    def append_log(actor_id: str, actor_email: str, action: str, entity_type: str, entity_id: str, payload: dict, client_ip: str = '127.0.0.1', user_agent: str = 'ITIMS-Core'):
        """Append an immutable hash-chained audit record via stored procedure"""
        supabase = get_supabase()
        params = {
            'p_actor_id': str(actor_id) if actor_id else None,
            'p_actor_email': str(actor_email),
            'p_action': str(action).upper(),
            'p_entity_type': str(entity_type).upper(),
            'p_entity_id': str(entity_id),
            'p_payload': payload or {},
            'p_client_ip': str(client_ip),
            'p_user_agent': str(user_agent)
        }
        res = supabase.rpc('append_cryptographic_audit_log', params).execute()
        return res.data

    @staticmethod
    def verify_chain_integrity():
        """Execute full ledger cryptographic integrity sweep"""
        supabase = get_supabase()
        res = supabase.rpc('verify_audit_log_chain_integrity', {}).execute()
        return res.data

    @staticmethod
    def generate_compliance_certificate(auditor_name: str = 'Enterprise Compliance Officer'):
        """Generate signed SOC 2 Type II / ISO 27001 audit certificate"""
        supabase = get_supabase()
        res = supabase.rpc('generate_compliance_certificate', {'p_auditor_name': str(auditor_name)}).execute()
        return res.data

    @staticmethod
    def list_logs(limit: int = 50, offset: int = 0, action: str = None):
        """List audit log entries ordered chronologically by sequence_number desc"""
        supabase = get_supabase()
        query = (
            supabase.table('cryptographic_audit_logs')
            .select('''
                *,
                actor:actor_id(id, full_name, email, role)
            ''')
            .order('sequence_number', desc=True)
            .range(offset, offset + limit - 1)
        )
        if action:
            query = query.ilike('action', f"%{action}%")
        res = query.execute()
        return res.data or []
