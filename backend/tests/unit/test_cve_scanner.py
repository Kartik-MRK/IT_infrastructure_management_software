"""Unit Tests for CVE Vulnerability Scanner Integration & Remediation Engine"""

import pytest
from unittest.mock import Mock, patch
from app import app
from app.schemas.cve_schema import validate_vuln_status_payload
from app.services.cve_service import CVEService

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

class TestCVESchema:
    """Test payload validation for CVE vulnerability status transitions"""

    def test_valid_status_payload(self):
        cleaned, error = validate_vuln_status_payload({'status': 'in_remediation', 'resolution_notes': 'Patch scheduled'})
        assert error is None
        assert cleaned['status'] == 'in_remediation'
        assert cleaned['resolution_notes'] == 'Patch scheduled'

    def test_missing_status(self):
        cleaned, error = validate_vuln_status_payload({})
        assert "Status field is required" in error

    def test_invalid_status_rejection(self):
        cleaned, error = validate_vuln_status_payload({'status': 'random_invalid_status'})
        assert "Invalid status" in error

class TestCVEService:
    """Test CVE scanning business logic and incident generation"""

    @patch('app.services.cve_service.CVERepository')
    def test_scan_asset_success(self, mock_repo):
        mock_repo.scan_asset.return_value = {
            'asset_id': 'asset-1',
            'vulnerabilities_detected': 2,
            'critical_count': 1,
            'highest_cvss': 9.8
        }
        res, error, status = CVEService.scan_asset('asset-1')
        assert status == 200
        assert res['critical_count'] == 1
        assert res['highest_cvss'] == 9.8

    @patch('app.services.cve_service.CVERepository')
    def test_create_remediation_incident_success(self, mock_repo):
        mock_repo.create_remediation_incident.return_value = {
            'message': 'Remediation incident created successfully',
            'incident_id': 'inc-99',
            'cve_id': 'CVE-2024-6387',
            'severity': 'critical',
            'vulnerability_status': 'in_remediation'
        }
        res, error, status = CVEService.create_remediation_incident('vuln-1', 'user-1')
        assert status == 201
        assert res['incident_id'] == 'inc-99'
        assert res['vulnerability_status'] == 'in_remediation'

    @patch('app.services.cve_service.CVERepository')
    def test_get_system_summary_success(self, mock_repo):
        mock_repo.get_system_summary.return_value = {
            'total_vulnerabilities': 14,
            'critical_count': 6,
            'high_count': 8,
            'vulnerable_assets_count': 5
        }
        summary, error, status = CVEService.get_system_summary()
        assert status == 200
        assert summary['critical_count'] == 6
        assert summary['vulnerable_assets_count'] == 5

class TestCVEEndpoints:
    """Test REST API endpoints for CVE scanner"""

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.cve_service.CVERepository')
    def test_scan_asset_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'user-1'
        mock_profile.return_value = {'id': 'user-1', 'role': 'operator'}
        mock_repo.scan_asset.return_value = {
            'asset_id': 'asset-1',
            'vulnerabilities_detected': 3,
            'findings': []
        }

        res = client.post('/api/assets/asset-1/scan-vulnerabilities',
                          headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['scan_result']['vulnerabilities_detected'] == 3

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.cve_service.CVERepository')
    def test_create_remediation_incident_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'user-1'
        mock_profile.return_value = {'id': 'user-1', 'role': 'operator'}
        mock_repo.create_remediation_incident.return_value = {
            'incident_id': 'inc-88',
            'cve_id': 'CVE-2024-3094',
            'severity': 'critical'
        }

        res = client.post('/api/vulnerabilities/vuln-1/create-incident',
                          headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 201
        data = res.get_json()
        assert data['incident_id'] == 'inc-88'

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.cve_service.CVERepository')
    def test_get_vulnerability_summary_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'user-1'
        mock_profile.return_value = {'id': 'user-1', 'role': 'viewer'}
        mock_repo.get_system_summary.return_value = {
            'total_vulnerabilities': 12,
            'critical_count': 4
        }

        res = client.get('/api/vulnerabilities/summary',
                         headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['summary']['critical_count'] == 4
