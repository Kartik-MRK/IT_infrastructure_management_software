"""Repository Layer for CVE Cache and Asset Vulnerability Data Access"""

from datetime import datetime, timezone
from ..core.database import get_supabase

class CVERepository:
    """DAO for CVE database, asset vulnerability scans, and remediation linking"""

    @staticmethod
    def scan_asset(asset_id: str):
        """Invoke PostgreSQL scan_asset_for_vulnerabilities stored procedure"""
        supabase = get_supabase()
        res = supabase.rpc('scan_asset_for_vulnerabilities', {'p_asset_id': str(asset_id)}).execute()
        return res.data

    @staticmethod
    def get_asset_vulnerabilities(asset_id: str):
        """Fetch all vulnerabilities detected on a specific asset"""
        supabase = get_supabase()
        res = (
            supabase.table('asset_vulnerabilities')
            .select('''
                *,
                cve:cve_id(cve_id, summary, cvss_score, severity, affected_product, affected_versions, fixed_version, epss_score, cve_references),
                remediation_incident:remediation_incident_id(id, title, status, severity)
            ''')
            .eq('asset_id', str(asset_id))
            .order('detected_at', desc=True)
            .execute()
        )
        return res.data or []

    @staticmethod
    def create_remediation_incident(vuln_id: str, reporter_id: str = None):
        """Invoke PostgreSQL create_remediation_incident_from_cve stored procedure"""
        supabase = get_supabase()
        params = {'p_vuln_id': str(vuln_id)}
        if reporter_id:
            params['p_reporter_id'] = str(reporter_id)
        res = supabase.rpc('create_remediation_incident_from_cve', params).execute()
        return res.data

    @staticmethod
    def update_vuln_status(vuln_id: str, status: str):
        """Update vulnerability lifecycle status"""
        supabase = get_supabase()
        update_data = {
            'status': status
        }
        if status == 'resolved':
            update_data['resolved_at'] = datetime.now(timezone.utc).isoformat()

        res = (
            supabase.table('asset_vulnerabilities')
            .update(update_data)
            .eq('id', str(vuln_id))
            .execute()
        )
        return res.data[0] if res.data else None

    @staticmethod
    def get_system_summary():
        """Invoke PostgreSQL get_system_vulnerability_summary stored procedure"""
        supabase = get_supabase()
        res = supabase.rpc('get_system_vulnerability_summary', {}).execute()
        return res.data

    @staticmethod
    def list_all_vulnerabilities(severity: str = None, status: str = None):
        """List all asset vulnerabilities across infrastructure with optional filters"""
        supabase = get_supabase()
        query = (
            supabase.table('asset_vulnerabilities')
            .select('''
                *,
                asset:asset_id(id, name, type, location),
                cve:cve_id(cve_id, summary, cvss_score, severity, affected_product, fixed_version),
                remediation_incident:remediation_incident_id(id, title, status, severity)
            ''')
            .order('detected_at', desc=True)
        )
        if status:
            query = query.eq('status', status)
        res = query.execute()
        data = res.data or []

        if severity:
            data = [d for d in data if d.get('cve', {}).get('severity') == severity]

        return data
