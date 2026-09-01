"""Repository Layer for Post-Mortem Documents & RCA Data Access"""

from datetime import datetime, timezone
from ..core.database import get_supabase

class PostMortemRepository:
    """DAO for incident post-mortems and stored procedure execution"""

    @staticmethod
    def generate_draft(incident_id: str, author_id: str = None):
        """Invoke PostgreSQL generate_incident_postmortem_draft stored procedure"""
        supabase = get_supabase()
        params = {'p_incident_id': str(incident_id)}
        if author_id:
            params['p_author_id'] = str(author_id)
        res = supabase.rpc('generate_incident_postmortem_draft', params).execute()
        return res.data

    @staticmethod
    def get_by_incident_id(incident_id: str):
        """Fetch post-mortem document for a specific incident"""
        supabase = get_supabase()
        res = (
            supabase.table('incident_postmortems')
            .select('''
                *,
                author:author_id(id, full_name, email),
                incident:incident_id(id, title, severity, status, category, reported_at, resolved_at)
            ''')
            .eq('incident_id', str(incident_id))
            .single()
            .execute()
        )
        return res.data

    @staticmethod
    def update_postmortem(incident_id: str, data: dict):
        """Update fields of an existing post-mortem report"""
        supabase = get_supabase()
        data['updated_at'] = datetime.now(timezone.utc).isoformat()
        if data.get('status') == 'published':
            data['published_at'] = datetime.now(timezone.utc).isoformat()

        res = (
            supabase.table('incident_postmortems')
            .update(data)
            .eq('incident_id', str(incident_id))
            .execute()
        )
        return res.data[0] if res.data else None

    @staticmethod
    def list_postmortems(status: str = None):
        """List all post-mortem reports with optional status filter"""
        supabase = get_supabase()
        query = (
            supabase.table('incident_postmortems')
            .select('''
                *,
                author:author_id(id, full_name, email),
                incident:incident_id(id, title, severity, status, category)
            ''')
            .order('created_at', desc=True)
        )
        if status:
            query = query.eq('status', status)
        res = query.execute()
        return res.data or []
