"""Unit Tests for Physical Asset Auditing, QR Verification & Compliance"""

import pytest
from unittest.mock import Mock, patch
from app import app
from app.schemas.audit_schema import validate_audit_payload
from app.services.audit_service import AuditService

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

class TestAuditValidation:
    """Test schema validation for physical asset audits"""

    def test_valid_audit_payload(self):
        data = {
            'physical_condition': 'good',
            'scan_method': 'camera_qr',
            'location_verified': True,
            'status_verified': True,
            'notes': 'Verified rack 4U location'
        }
        cleaned, error = validate_audit_payload(data)
        assert error is None
        assert cleaned['physical_condition'] == 'good'
        assert cleaned['scan_method'] == 'camera_qr'
        assert cleaned['location_verified'] is True

    def test_invalid_condition_rejection(self):
        cleaned, error = validate_audit_payload({'physical_condition': 'destroyed_beyond_belief'})
        assert "Invalid physical_condition" in error

    def test_invalid_scan_method_rejection(self):
        cleaned, error = validate_audit_payload({'scan_method': 'telepathy'})
        assert "Invalid scan_method" in error

    def test_default_values_populated(self):
        cleaned, error = validate_audit_payload({})
        assert error is None
        assert cleaned['physical_condition'] == 'good'
        assert cleaned['scan_method'] == 'camera_qr'
        assert cleaned['location_verified'] is True

class TestAuditServiceLogic:
    """Test physical audit business workflows and discrepancy detection"""

    @patch('app.services.audit_service.AssetRepository')
    @patch('app.services.audit_service.AuditRepository')
    def test_record_audit_with_location_discrepancy(self, mock_audit_repo, mock_asset_repo):
        mock_asset_repo.get_by_id.return_value.data = {
            'id': 'asset-1',
            'name': 'Core Switch A',
            'location': 'Datacenter A - Rack 04',
            'status': 'active'
        }
        mock_audit_repo.record_audit.return_value = {
            'audit_id': 'audit-100',
            'asset_id': 'asset-1',
            'audit_status': 'flagged'
        }

        # Auditor observed the switch in "Floor 2 Storage Room" instead of "Datacenter A"
        result, error, status = AuditService.record_physical_audit(
            asset_id='asset-1',
            auditor_id='user-1',
            data={
                'observed_location': 'Floor 2 Storage Room',
                'physical_condition': 'good',
                'notes': 'Device found in wrong room!'
            }
        )
        assert status == 201
        assert result['audit']['audit_status'] == 'flagged'
        # Verify location_verified was marked False
        args = mock_audit_repo.record_audit.call_args[0][2]
        assert args['location_verified'] is False

    @patch('app.services.audit_service.AssetRepository')
    def test_record_audit_asset_not_found(self, mock_asset_repo):
        mock_asset_repo.get_by_id.return_value.data = None
        result, error, status = AuditService.record_physical_audit(
            asset_id='nonexistent',
            auditor_id='user-1',
            data={}
        )
        assert status == 404
        assert "not found" in error

class TestAuditEndpoints:
    """Test REST API endpoints for physical audits"""

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.audit_service.AssetRepository')
    @patch('app.services.audit_service.AuditRepository')
    def test_record_audit_endpoint(self, mock_audit_repo, mock_asset_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'auditor-1'
        mock_profile.return_value = {'id': 'auditor-1', 'role': 'technician'}
        mock_asset_repo.get_by_id.return_value.data = {'id': 'a-1', 'name': 'ThinkPad T14', 'location': 'HQ'}
        mock_audit_repo.record_audit.return_value = {
            'audit_id': 'audit-1',
            'audit_status': 'verified'
        }

        res = client.post('/api/assets/a-1/audits',
                          json={'physical_condition': 'excellent', 'scan_method': 'camera_qr'},
                          headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 201
        data = res.get_json()
        assert data['audit']['audit_status'] == 'verified'

    @patch('app.get_jwt_identity')
    @patch('app.services.audit_service.AssetRepository')
    @patch('app.services.audit_service.AuditRepository')
    def test_get_asset_audits_endpoint(self, mock_audit_repo, mock_asset_repo, mock_jwt, client):
        mock_jwt.return_value = 'user-1'
        mock_asset_repo.get_by_id.return_value.data = {'id': 'a-1', 'name': 'ThinkPad T14'}
        mock_res = Mock()
        mock_res.data = [
            {'id': 'audit-1', 'physical_condition': 'good', 'scan_method': 'camera_qr'}
        ]
        mock_audit_repo.get_asset_audits.return_value = mock_res

        res = client.get('/api/assets/a-1/audits', headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert 'audits' in data
        assert len(data['audits']) == 1

    @patch('app.get_jwt_identity')
    @patch('app.services.audit_service.AuditRepository')
    def test_get_audit_summary_endpoint(self, mock_audit_repo, mock_jwt, client):
        mock_jwt.return_value = 'user-1'
        mock_audit_repo.get_summary.return_value = {
            'total_assets': 19,
            'audited_last_90_days': 15,
            'audit_compliance_percent': 78.95,
            'verified_count': 14,
            'flagged_count': 1
        }

        res = client.get('/api/audits/summary', headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['audit_compliance_percent'] == 78.95
