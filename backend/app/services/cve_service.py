"""Service Layer for CVE Vulnerability Scanning, CVSS Scoring & Incident Remediation"""

from ..schemas.cve_schema import validate_vuln_status_payload
from ..repositories.cve_repository import CVERepository

class CVEService:
    """Encapsulates business logic for vulnerability scanning, posture evaluation, and automated remediation"""

    @staticmethod
    def scan_asset(asset_id: str):
        """Scan asset against CVE cache database and update security findings"""
        try:
            scan_result = CVERepository.scan_asset(asset_id)
            return scan_result, None, 200
        except Exception as err:
            return None, f"Failed to execute CVE vulnerability scan: {str(err)}", 500

    @staticmethod
    def get_asset_vulnerabilities(asset_id: str):
        """Retrieve detected CVE vulnerabilities on an asset"""
        try:
            vulns = CVERepository.get_asset_vulnerabilities(asset_id)
            return vulns, None, 200
        except Exception as err:
            return None, f"Failed to retrieve asset vulnerabilities: {str(err)}", 500

    @staticmethod
    def create_remediation_incident(vuln_id: str, reporter_id: str = None):
        """1-Click generation of prioritized incident ticket from a CVE finding"""
        try:
            result = CVERepository.create_remediation_incident(vuln_id, reporter_id)
            return result, None, 201
        except Exception as err:
            return None, f"Failed to create remediation incident: {str(err)}", 500

    @staticmethod
    def update_vuln_status(vuln_id: str, payload: dict):
        """Update vulnerability lifecycle status"""
        cleaned, error = validate_vuln_status_payload(payload)
        if error:
            return None, error, 400

        try:
            updated = CVERepository.update_vuln_status(vuln_id, cleaned['status'])
            if not updated:
                return None, "Vulnerability record not found", 404
            return updated, None, 200
        except Exception as err:
            return None, f"Failed to update vulnerability status: {str(err)}", 500

    @staticmethod
    def get_system_summary():
        """Retrieve global vulnerability posture summary"""
        try:
            summary = CVERepository.get_system_summary()
            return summary, None, 200
        except Exception as err:
            return None, f"Failed to retrieve vulnerability summary: {str(err)}", 500

    @staticmethod
    def list_all_vulnerabilities(severity: str = None, status: str = None):
        """List all vulnerability findings across the entire infrastructure"""
        try:
            vulns = CVERepository.list_all_vulnerabilities(severity, status)
            return vulns, None, 200
        except Exception as err:
            return None, f"Failed to list vulnerabilities: {str(err)}", 500
