"""Unit Tests for Software License Management & Seat Compliance"""

import pytest
from unittest.mock import Mock, patch
from app import app
from app.schemas.license_schema import validate_license_data, validate_allocation_data
from app.services.license_service import LicenseService

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

class TestLicenseValidation:
    """Test schema validation for licenses and allocations"""

    def test_missing_required_fields_on_create(self):
        cleaned, error = validate_license_data({}, is_update=False)
        assert error == "software_asset_id is required"

        cleaned, error = validate_license_data({'software_asset_id': 'asset-1'}, is_update=False)
        assert error == "license_name is required"

    def test_invalid_license_type(self):
        cleaned, error = validate_license_data({
            'software_asset_id': 'asset-1',
            'license_name': 'VS Code Enterprise',
            'license_type': 'invalid_type'
        })
        assert "Invalid license_type" in error

    def test_negative_total_seats(self):
        cleaned, error = validate_license_data({
            'software_asset_id': 'asset-1',
            'license_name': 'VS Code Enterprise',
            'total_seats': -5
        })
        assert "greater than or equal to 0" in error

    def test_invalid_date_format(self):
        cleaned, error = validate_license_data({
            'software_asset_id': 'asset-1',
            'license_name': 'VS Code Enterprise',
            'expiration_date': '31-12-2026' # Invalid format
        })
        assert "YYYY-MM-DD" in error

    def test_allocation_missing_target(self):
        cleaned, error = validate_allocation_data({})
        assert "Seat must be allocated to either an asset" in error

    def test_valid_allocation_payload(self):
        cleaned, error = validate_allocation_data({
            'allocated_to_asset_id': 'hardware-123',
            'notes': 'Engineering Workstation #4'
        })
        assert error is None
        assert cleaned['allocated_to_asset_id'] == 'hardware-123'
        assert cleaned['notes'] == 'Engineering Workstation #4'

class TestLicenseComplianceLogic:
    """Test real-time compliance status computations"""

    def test_compliant_license(self):
        lic = {
            'total_seats': 100,
            'allocations': [{'id': f'alloc-{i}'} for i in range(40)],
            'expiration_date': '2099-12-31'
        }
        metrics = LicenseService._compute_license_metrics(lic)
        assert metrics['allocated_seats'] == 40
        assert metrics['available_seats'] == 60
        assert metrics['utilization_percent'] == 40.0
        assert metrics['compliance_status'] == 'COMPLIANT'

    def test_warning_90_percent_license(self):
        lic = {
            'total_seats': 100,
            'allocations': [{'id': f'alloc-{i}'} for i in range(92)],
            'expiration_date': '2099-12-31'
        }
        metrics = LicenseService._compute_license_metrics(lic)
        assert metrics['utilization_percent'] == 92.0
        assert metrics['compliance_status'] == 'WARNING_90_PERCENT'

    def test_over_allocated_license(self):
        lic = {
            'total_seats': 10,
            'allocations': [{'id': f'alloc-{i}'} for i in range(12)],
            'expiration_date': '2099-12-31'
        }
        metrics = LicenseService._compute_license_metrics(lic)
        assert metrics['utilization_percent'] == 120.0
        assert metrics['compliance_status'] == 'OVER_ALLOCATED'

    def test_expired_license(self):
        lic = {
            'total_seats': 50,
            'allocations': [{'id': 'alloc-1'}],
            'expiration_date': '2020-01-01' # In past
        }
        metrics = LicenseService._compute_license_metrics(lic)
        assert metrics['compliance_status'] == 'EXPIRED'

class TestLicenseEndpoints:
    """Test software license REST endpoints"""

    @patch('app.get_jwt_identity')
    @patch('app.supabase')
    def test_get_licenses_endpoint(self, mock_supabase, mock_jwt, client):
        mock_jwt.return_value = 'user-123'
        mock_res = Mock()
        mock_res.data = [
            {
                'id': 'lic-1',
                'software_asset_id': 'asset-1',
                'license_name': 'JetBrains All Products',
                'license_type': 'per_seat',
                'total_seats': 25,
                'allocations': []
            }
        ]
        mock_supabase.table.return_value.select.return_value.order.return_value.execute.return_value = mock_res
        
        response = client.get('/api/licenses', headers={'Authorization': 'Bearer test-token'})
        assert response.status_code == 200
        data = response.get_json()
        assert 'licenses' in data
        assert len(data['licenses']) == 1
        assert data['licenses'][0]['compliance_status'] == 'COMPLIANT'

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_create_license_endpoint(self, mock_supabase, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {'id': 'admin-123', 'role': 'it_admin'}

        mock_asset = Mock()
        mock_asset.data = {'id': 'asset-1', 'name': 'Docker Desktop', 'type': 'software', 'status': 'active'}
        
        mock_lic = Mock()
        mock_lic.data = [{
            'id': 'lic-1',
            'software_asset_id': 'asset-1',
            'license_name': 'Docker Desktop Pro',
            'license_type': 'subscription',
            'total_seats': 50
        }]
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_asset
        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_lic
        
        response = client.post('/api/licenses',
                               json={
                                   'software_asset_id': 'asset-1',
                                   'license_name': 'Docker Desktop Pro',
                                   'license_type': 'subscription',
                                   'total_seats': 50,
                                   'vendor': 'Docker Inc.'
                               },
                               headers={'Authorization': 'Bearer test-token'})
        assert response.status_code == 201
        data = response.get_json()
        assert 'license' in data
        assert data['license']['license_name'] == 'Docker Desktop Pro'

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_allocate_seat_endpoint(self, mock_supabase, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {'id': 'admin-123', 'role': 'it_admin'}

        mock_lic = Mock()
        mock_lic.data = {'id': 'lic-1', 'license_name': 'IntelliJ IDEA', 'total_seats': 10}
        
        mock_hw = Mock()
        mock_hw.data = {'id': 'hw-1', 'name': 'Dev Laptop #1', 'type': 'hardware'}
        
        mock_alloc = Mock()
        mock_alloc.data = [{
            'id': 'alloc-1',
            'license_id': 'lic-1',
            'allocated_to_asset_id': 'hw-1'
        }]
        
        # Chain mock responses
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = [mock_lic, mock_hw]
        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_alloc

        response = client.post('/api/licenses/lic-1/allocate',
                               json={
                                   'allocated_to_asset_id': 'hw-1',
                                   'notes': 'Senior Developer Machine'
                               },
                               headers={'Authorization': 'Bearer test-token'})
        assert response.status_code == 201
        data = response.get_json()
        assert 'allocation' in data
        assert data['allocation']['allocated_to_asset_id'] == 'hw-1'

    @patch('app.get_jwt_identity')
    @patch('app.supabase')
    def test_get_compliance_summary_endpoint(self, mock_supabase, mock_jwt, client):
        mock_jwt.return_value = 'user-123'
        mock_rpc = Mock()
        mock_rpc.data = [
            {
                'license_id': 'lic-1',
                'license_name': 'AutoCAD',
                'total_seats': 10,
                'allocated_seats': 9,
                'compliance_status': 'WARNING_90_PERCENT'
            }
        ]
        mock_supabase.rpc.return_value.execute.return_value = mock_rpc
        
        response = client.get('/api/licenses/compliance-summary', headers={'Authorization': 'Bearer test-token'})
        assert response.status_code == 200
        data = response.get_json()
        assert 'overview' in data
        assert 'compliance_breakdown' in data
        assert data['compliance_breakdown']['warning_90_percent'] == 1
