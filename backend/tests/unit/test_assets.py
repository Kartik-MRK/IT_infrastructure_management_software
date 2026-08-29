"""
Unit tests for Asset Management functionality
Tests CRUD operations, validation, and business logic for assets
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, date
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app import app, supabase


@pytest.fixture
def client():
    """Create test client"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def mock_jwt_user():
    """Mock JWT user identity"""
    return 'test-user-id-123'


@pytest.fixture
def mock_admin_profile():
    """Mock admin user profile"""
    return {
        'id': 'test-user-id-123',
        'email': 'admin@test.com',
        'full_name': 'Test Admin',
        'role': 'admin'
    }


@pytest.fixture
def mock_operator_profile():
    """Mock operator user profile"""
    return {
        'id': 'test-user-id-456',
        'email': 'operator@test.com',
        'full_name': 'Test Operator',
        'role': 'operator'
    }


@pytest.fixture
def mock_viewer_profile():
    """Mock viewer user profile"""
    return {
        'id': 'test-user-id-789',
        'email': 'viewer@test.com',
        'full_name': 'Test Viewer',
        'role': 'viewer'
    }


@pytest.fixture
def sample_asset():
    """Sample asset data"""
    return {
        'id': 'asset-123',
        'name': 'Dell Laptop',
        'type': 'hardware',
        'status': 'active',
        'description': 'Development laptop',
        'serial_number': 'DL12345',
        'location': 'Office 101',
        'purchase_date': '2023-01-15',
        'warranty_expiry': '2026-01-15',
        'cost': 1200.50,
        'assigned_to': 'user-456',
        'created_by': 'test-user-id-123',
        'created_at': '2023-01-15T10:00:00Z',
        'updated_at': '2023-01-15T10:00:00Z'
    }


class TestAssetCreation:
    """Test asset creation logic"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_create_asset_success_admin(self, mock_supabase, mock_profile, mock_jwt, 
                                       client, mock_admin_profile, sample_asset):
        """Test successful asset creation by admin"""
        mock_jwt.return_value = 'test-user-id-123'
        mock_profile.return_value = mock_admin_profile
        
        # Mock Supabase insert response
        mock_response = Mock()
        mock_response.data = [sample_asset]
        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_response
        
        response = client.post('/api/assets', 
                              json={
                                  'name': 'Dell Laptop',
                                  'type': 'hardware',
                                  'status': 'active',
                                  'description': 'Development laptop',
                                  'serial_number': 'DL12345',
                                  'location': 'Office 101'
                              },
                              headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 201
        data = response.get_json()
        assert 'asset' in data
        assert data['asset']['name'] == 'Dell Laptop'
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_create_asset_success_operator(self, mock_supabase, mock_profile, mock_jwt,
                                          client, mock_operator_profile, sample_asset):
        """Test successful asset creation by operator"""
        mock_jwt.return_value = 'test-user-id-456'
        mock_profile.return_value = mock_operator_profile
        
        mock_response = Mock()
        mock_response.data = [sample_asset]
        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_response
        
        response = client.post('/api/assets',
                              json={
                                  'name': 'Network Switch',
                                  'type': 'network',
                                  'status': 'active'
                              },
                              headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 201
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    def test_create_asset_forbidden_viewer(self, mock_profile, mock_jwt,
                                          client, mock_viewer_profile):
        """Test asset creation forbidden for viewer role"""
        mock_jwt.return_value = 'test-user-id-789'
        mock_profile.return_value = mock_viewer_profile
        
        response = client.post('/api/assets',
                              json={
                                  'name': 'Test Asset',
                                  'type': 'hardware',
                                  'status': 'active'
                              },
                              headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 403
        data = response.get_json()
        assert 'error' in data
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    def test_create_asset_missing_required_fields(self, mock_profile, mock_jwt,
                                                  client, mock_admin_profile):
        """Test asset creation with missing required fields"""
        mock_jwt.return_value = 'test-user-id-123'
        mock_profile.return_value = mock_admin_profile
        
        # Missing 'type' field
        response = client.post('/api/assets',
                              json={
                                  'name': 'Test Asset',
                                  'status': 'active'
                              },
                              headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data
        assert 'type' in data['error'].lower()
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    def test_create_asset_missing_name(self, mock_profile, mock_jwt,
                                      client, mock_admin_profile):
        """Test asset creation with missing name"""
        mock_jwt.return_value = 'test-user-id-123'
        mock_profile.return_value = mock_admin_profile
        
        response = client.post('/api/assets',
                              json={
                                  'type': 'hardware',
                                  'status': 'active'
                              },
                              headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 400


class TestAssetRetrieval:
    """Test asset retrieval operations"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_get_all_assets(self, mock_supabase, mock_profile, mock_jwt,
                           client, mock_admin_profile, sample_asset):
        """Test retrieving all assets"""
        mock_jwt.return_value = 'test-user-id-123'
        mock_profile.return_value = mock_admin_profile
        
        mock_response = Mock()
        mock_response.data = [sample_asset]
        mock_supabase.table.return_value.select.return_value.execute.return_value = mock_response
        
        response = client.get('/api/assets',
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'assets' in data
        assert 'count' in data
        assert len(data['assets']) > 0
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_get_single_asset(self, mock_supabase, mock_profile, mock_jwt,
                             client, mock_admin_profile, sample_asset):
        """Test retrieving a single asset by ID"""
        mock_jwt.return_value = 'test-user-id-123'
        mock_profile.return_value = mock_admin_profile
        
        mock_response = Mock()
        mock_response.data = sample_asset
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response
        
        response = client.get('/api/assets/asset-123',
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'asset' in data
        assert data['asset']['id'] == 'asset-123'
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_get_nonexistent_asset(self, mock_supabase, mock_profile, mock_jwt,
                                   client, mock_admin_profile):
        """Test retrieving a non-existent asset"""
        mock_jwt.return_value = 'test-user-id-123'
        mock_profile.return_value = mock_admin_profile
        
        mock_response = Mock()
        mock_response.data = None
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response
        
        response = client.get('/api/assets/nonexistent-id',
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 404


class TestAssetUpdate:
    """Test asset update operations"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_update_asset_admin(self, mock_supabase, mock_profile, mock_jwt,
                               client, mock_admin_profile, sample_asset):
        """Test asset update by admin"""
        mock_jwt.return_value = 'test-user-id-123'
        mock_profile.return_value = mock_admin_profile
        
        # Mock existing asset check
        mock_existing = Mock()
        mock_existing.data = sample_asset
        
        # Mock update response
        mock_update = Mock()
        updated_asset = sample_asset.copy()
        updated_asset['status'] = 'maintenance'
        mock_update.data = [updated_asset]
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_existing
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update
        
        response = client.put('/api/assets/asset-123',
                             json={'status': 'maintenance'},
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'asset' in data
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_update_asset_operator_own(self, mock_supabase, mock_profile, mock_jwt,
                                      client, mock_operator_profile, sample_asset):
        """Test operator updating their own asset"""
        mock_jwt.return_value = 'test-user-id-456'
        mock_profile.return_value = mock_operator_profile
        
        # Create asset owned by operator
        operator_asset = sample_asset.copy()
        operator_asset['created_by'] = 'test-user-id-456'
        
        mock_existing = Mock()
        mock_existing.data = operator_asset
        
        mock_update = Mock()
        mock_update.data = [operator_asset]
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_existing
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update
        
        response = client.put(f'/api/assets/{operator_asset["id"]}',
                             json={'location': 'Office 202'},
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_update_asset_operator_others(self, mock_supabase, mock_profile, mock_jwt,
                                         client, mock_operator_profile, sample_asset):
        """Test operator cannot update others' assets"""
        mock_jwt.return_value = 'test-user-id-456'
        mock_profile.return_value = mock_operator_profile
        
        # Asset created by someone else
        mock_existing = Mock()
        mock_existing.data = sample_asset  # created_by is different
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_existing
        
        response = client.put('/api/assets/asset-123',
                             json={'status': 'maintenance'},
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 403


class TestAssetValidation:
    """Test asset data validation"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    def test_invalid_asset_type(self, mock_profile, mock_jwt,
                               client, mock_admin_profile):
        """Test validation of invalid asset type"""
        mock_jwt.return_value = 'test-user-id-123'
        mock_profile.return_value = mock_admin_profile
        
        # Note: Type validation happens at DB level in real app
        # This tests client-side validation if implemented
        response = client.post('/api/assets',
                              json={
                                  'name': 'Test Asset',
                                  'type': 'invalid_type',
                                  'status': 'active'
                              },
                              headers={'Authorization': 'Bearer test-token'})
        
        # Should either reject or let DB handle it
        assert response.status_code in [400, 500]
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    def test_invalid_asset_status(self, mock_profile, mock_jwt,
                                  client, mock_admin_profile):
        """Test validation of invalid asset status"""
        mock_jwt.return_value = 'test-user-id-123'
        mock_profile.return_value = mock_admin_profile
        
        response = client.post('/api/assets',
                              json={
                                  'name': 'Test Asset',
                                  'type': 'hardware',
                                  'status': 'invalid_status'
                              },
                              headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code in [400, 500]


class TestAssetDelete:
    """Test asset deletion operations"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_delete_asset_admin(self, mock_supabase, mock_profile, mock_jwt,
                               client, mock_admin_profile):
        """Test asset deletion by admin"""
        mock_jwt.return_value = 'test-user-id-123'
        mock_profile.return_value = mock_admin_profile
        
        mock_response = Mock()
        mock_response.data = [{'id': 'asset-123'}]
        mock_supabase.table.return_value.delete.return_value.eq.return_value.execute.return_value = mock_response
        
        response = client.delete('/api/assets/asset-123',
                                headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    def test_delete_asset_forbidden_operator(self, mock_profile, mock_jwt,
                                            client, mock_operator_profile):
        """Test asset deletion forbidden for operator"""
        mock_jwt.return_value = 'test-user-id-456'
        mock_profile.return_value = mock_operator_profile
        
        response = client.delete('/api/assets/asset-123',
                                headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 403


class TestAssetEdgeCases:
    """Test edge cases and boundary conditions"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_create_asset_with_null_optional_fields(self, mock_supabase, mock_profile, mock_jwt,
                                                    client, mock_admin_profile, sample_asset):
        """Test creating asset with null optional fields"""
        mock_jwt.return_value = 'test-user-id-123'
        mock_profile.return_value = mock_admin_profile
        
        mock_response = Mock()
        mock_response.data = [sample_asset]
        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_response
        
        response = client.post('/api/assets',
                              json={
                                  'name': 'Minimal Asset',
                                  'type': 'hardware',
                                  'status': 'active',
                                  'description': None,
                                  'serial_number': None
                              },
                              headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 201
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_update_asset_empty_payload(self, mock_supabase, mock_profile, mock_jwt,
                                       client, mock_admin_profile, sample_asset):
        """Test updating asset with empty payload"""
        mock_jwt.return_value = 'test-user-id-123'
        mock_profile.return_value = mock_admin_profile
        
        mock_existing = Mock()
        mock_existing.data = sample_asset
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_existing
        
        response = client.put('/api/assets/asset-123',
                             json={},
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data
