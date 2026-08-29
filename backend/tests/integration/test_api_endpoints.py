"""
Integration tests for API endpoints
Tests end-to-end API flows with mocked Supabase database
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app import app


@pytest.fixture
def client():
    """Create test client"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def mock_admin_token():
    """Mock admin JWT token"""
    return 'Bearer test-admin-token-123'


@pytest.fixture
def mock_operator_token():
    """Mock operator JWT token"""
    return 'Bearer test-operator-token-456'


@pytest.fixture
def mock_viewer_token():
    """Mock viewer JWT token"""
    return 'Bearer test-viewer-token-789'


class TestHealthEndpoint:
    """Test health check endpoint"""
    
    def test_health_check_success(self, client):
        """Test health check returns 200"""
        response = client.get('/api/health')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'healthy'
        assert 'message' in data


class TestAuthenticationFlow:
    """Test authentication endpoints"""
    
    @patch('app.supabase')
    def test_register_success(self, mock_supabase, client):
        """Test user registration"""
        mock_user = Mock()
        mock_user.id = 'new-user-123'
        mock_user.email = 'newuser@test.com'
        
        mock_response = Mock()
        mock_response.user = mock_user
        
        mock_supabase.auth.sign_up.return_value = mock_response
        
        response = client.post('/api/auth/register',
                              json={
                                  'email': 'newuser@test.com',
                                  'password': 'SecurePass123!'
                              })
        
        assert response.status_code == 201
        data = response.get_json()
        assert 'user' in data
        assert data['user']['email'] == 'newuser@test.com'
    
    @patch('app.supabase')
    def test_register_missing_credentials(self, mock_supabase, client):
        """Test registration with missing credentials"""
        response = client.post('/api/auth/register',
                              json={
                                  'email': 'test@test.com'
                                  # Missing password
                              })
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data
    
    @patch('app.supabase')
    @patch('app.create_access_token')
    def test_login_success(self, mock_token, mock_supabase, client):
        """Test successful login"""
        mock_user = Mock()
        mock_user.id = 'user-123'
        mock_user.email = 'test@test.com'
        
        mock_response = Mock()
        mock_response.user = mock_user
        
        mock_supabase.auth.sign_in_with_password.return_value = mock_response
        mock_token.return_value = 'test-jwt-token'
        
        response = client.post('/api/auth/login',
                              json={
                                  'email': 'test@test.com',
                                  'password': 'password123'
                              })
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'access_token' in data
        assert 'user' in data
    
    @patch('app.supabase')
    def test_login_invalid_credentials(self, mock_supabase, client):
        """Test login with invalid credentials"""
        mock_response = Mock()
        mock_response.user = None
        
        mock_supabase.auth.sign_in_with_password.return_value = mock_response
        
        response = client.post('/api/auth/login',
                              json={
                                  'email': 'wrong@test.com',
                                  'password': 'wrongpass'
                              })
        
        assert response.status_code == 401


class TestAssetAPIEndpoints:
    """Test asset management API endpoints"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_get_assets_endpoint(self, mock_supabase, mock_profile, mock_jwt,
                                 client, mock_admin_token):
        """Test GET /api/assets"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {
            'id': 'admin-123',
            'email': 'admin@test.com',
            'role': 'admin'
        }
        
        mock_response = Mock()
        mock_response.data = [
            {
                'id': 'asset-1',
                'name': 'Laptop 1',
                'type': 'hardware',
                'status': 'active'
            },
            {
                'id': 'asset-2',
                'name': 'Server 1',
                'type': 'hardware',
                'status': 'active'
            }
        ]
        
        mock_supabase.table.return_value.select.return_value.execute.return_value = mock_response
        
        response = client.get('/api/assets',
                             headers={'Authorization': mock_admin_token})
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'assets' in data
        assert 'count' in data
        assert data['count'] == 2
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_create_asset_endpoint(self, mock_supabase, mock_profile, mock_jwt,
                                   client, mock_admin_token):
        """Test POST /api/assets"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {
            'id': 'admin-123',
            'email': 'admin@test.com',
            'role': 'admin'
        }
        
        new_asset = {
            'id': 'asset-new',
            'name': 'New Server',
            'type': 'hardware',
            'status': 'active',
            'description': 'New production server',
            'created_by': 'admin-123'
        }
        
        mock_response = Mock()
        mock_response.data = [new_asset]
        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_response
        
        response = client.post('/api/assets',
                              json={
                                  'name': 'New Server',
                                  'type': 'hardware',
                                  'status': 'active',
                                  'description': 'New production server'
                              },
                              headers={'Authorization': mock_admin_token})
        
        assert response.status_code == 201
        data = response.get_json()
        assert 'asset' in data
        assert data['asset']['name'] == 'New Server'
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_get_single_asset_endpoint(self, mock_supabase, mock_profile, mock_jwt,
                                      client, mock_viewer_token):
        """Test GET /api/assets/<id>"""
        mock_jwt.return_value = 'viewer-789'
        mock_profile.return_value = {
            'id': 'viewer-789',
            'email': 'viewer@test.com',
            'role': 'viewer'
        }
        
        asset = {
            'id': 'asset-123',
            'name': 'Test Asset',
            'type': 'hardware',
            'status': 'active',
            'description': 'Test description'
        }
        
        mock_response = Mock()
        mock_response.data = asset
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response
        
        response = client.get('/api/assets/asset-123',
                             headers={'Authorization': mock_viewer_token})
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'asset' in data
        assert data['asset']['id'] == 'asset-123'
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_update_asset_endpoint(self, mock_supabase, mock_profile, mock_jwt,
                                   client, mock_admin_token):
        """Test PUT /api/assets/<id>"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {
            'id': 'admin-123',
            'email': 'admin@test.com',
            'role': 'admin'
        }
        
        existing_asset = {
            'id': 'asset-123',
            'name': 'Old Name',
            'type': 'hardware',
            'status': 'active',
            'created_by': 'admin-123'
        }
        
        updated_asset = existing_asset.copy()
        updated_asset['name'] = 'Updated Name'
        updated_asset['status'] = 'maintenance'
        
        mock_existing = Mock()
        mock_existing.data = existing_asset
        
        mock_update = Mock()
        mock_update.data = [updated_asset]
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_existing
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update
        
        response = client.put('/api/assets/asset-123',
                             json={
                                 'name': 'Updated Name',
                                 'status': 'maintenance'
                             },
                             headers={'Authorization': mock_admin_token})
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'asset' in data
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_delete_asset_endpoint(self, mock_supabase, mock_profile, mock_jwt,
                                   client, mock_admin_token):
        """Test DELETE /api/assets/<id>"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {
            'id': 'admin-123',
            'email': 'admin@test.com',
            'role': 'admin'
        }
        
        mock_response = Mock()
        mock_response.data = [{'id': 'asset-123'}]
        mock_supabase.table.return_value.delete.return_value.eq.return_value.execute.return_value = mock_response
        
        response = client.delete('/api/assets/asset-123',
                                headers={'Authorization': mock_admin_token})
        
        assert response.status_code == 200


class TestIncidentAPIEndpoints:
    """Test incident management API endpoints"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_create_incident_endpoint(self, mock_supabase, mock_profile, mock_jwt,
                                      client, mock_viewer_token):
        """Test POST /api/incidents"""
        mock_jwt.return_value = 'viewer-789'
        mock_profile.return_value = {
            'id': 'viewer-789',
            'email': 'viewer@test.com',
            'role': 'viewer'
        }
        
        new_incident = {
            'id': 'incident-new',
            'title': 'Server Issue',
            'description': 'Server not responding',
            'severity': 'critical',
            'status': 'open',
            'reported_by': 'viewer-789'
        }
        
        mock_response = Mock()
        mock_response.data = [new_incident]
        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_response
        
        response = client.post('/api/incidents',
                              json={
                                  'title': 'Server Issue',
                                  'description': 'Server not responding',
                                  'severity': 'critical'
                              },
                              headers={'Authorization': mock_viewer_token})
        
        assert response.status_code == 201
        data = response.get_json()
        assert 'incident' in data
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_get_incidents_endpoint(self, mock_supabase, mock_profile, mock_jwt,
                                   client, mock_operator_token):
        """Test GET /api/incidents"""
        mock_jwt.return_value = 'operator-456'
        mock_profile.return_value = {
            'id': 'operator-456',
            'email': 'operator@test.com',
            'role': 'operator'
        }
        
        mock_response = Mock()
        mock_response.data = [
            {
                'id': 'incident-1',
                'title': 'Issue 1',
                'severity': 'high',
                'status': 'open',
                'reporter': {'id': 'user-1', 'email': 'user@test.com', 'full_name': 'User 1'},
                'assignee': None,
                'resolver': None,
                'asset': None
            },
            {
                'id': 'incident-2',
                'title': 'Issue 2',
                'severity': 'medium',
                'status': 'in_progress',
                'reporter': {'id': 'user-2', 'email': 'user2@test.com', 'full_name': 'User 2'},
                'assignee': None,
                'resolver': None,
                'asset': None
            }
        ]
        
        mock_supabase.table.return_value.select.return_value.order.return_value.order.return_value.execute.return_value = mock_response
        
        response = client.get('/api/incidents',
                             headers={'Authorization': mock_operator_token})
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'incidents' in data
        assert 'count' in data
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_update_incident_endpoint(self, mock_supabase, mock_profile, mock_jwt,
                                     client, mock_operator_token):
        """Test PUT /api/incidents/<id>"""
        mock_jwt.return_value = 'operator-456'
        mock_profile.return_value = {
            'id': 'operator-456',
            'email': 'operator@test.com',
            'role': 'operator'
        }
        
        existing_incident = {
            'id': 'incident-123',
            'title': 'Test Incident',
            'status': 'open',
            'reported_by': 'viewer-789',
            'assigned_to': 'operator-456'
        }
        
        updated_incident = existing_incident.copy()
        updated_incident['status'] = 'in_progress'
        
        mock_existing = Mock()
        mock_existing.data = existing_incident
        
        mock_update = Mock()
        mock_update.data = [updated_incident]
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_existing
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update
        
        response = client.put('/api/incidents/incident-123',
                             json={'status': 'in_progress'},
                             headers={'Authorization': mock_operator_token})
        
        assert response.status_code == 200


class TestMetricsAPIEndpoints:
    """Test metrics and monitoring API endpoints"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_get_asset_metrics_endpoint(self, mock_supabase, mock_profile, mock_jwt,
                                       client, mock_admin_token):
        """Test GET /api/assets/<id>/metrics"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {
            'id': 'admin-123',
            'email': 'admin@test.com',
            'role': 'admin'
        }
        
        mock_response = Mock()
        mock_response.data = {
            'id': 'metric-123',
            'asset_id': 'asset-123',
            'cpu_usage': 65.5,
            'memory_usage': 72.0,
            'disk_usage': 55.0,
            'temperature': 60.0,
            'health_status': 'healthy',
            'last_updated': '2024-01-15T10:00:00Z'
        }
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response
        
        response = client.get('/api/assets/asset-123/metrics',
                             headers={'Authorization': mock_admin_token})
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'metrics' in data
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_get_assets_summary_endpoint(self, mock_supabase, mock_profile, mock_jwt,
                                        client, mock_operator_token):
        """Test GET /api/assets/summary"""
        mock_jwt.return_value = 'operator-456'
        mock_profile.return_value = {
            'id': 'operator-456',
            'email': 'operator@test.com',
            'role': 'operator'
        }
        
        # Mock all asset count queries with proper count attribute
        def create_count_mock(count_value):
            mock = Mock()
            mock.count = count_value
            mock.data = []
            return mock
        
        mock_supabase.table.return_value.select.return_value.execute.return_value = create_count_mock(3)
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = create_count_mock(2)
        
        response = client.get('/api/assets/summary',
                             headers={'Authorization': mock_operator_token})
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'summary' in data
        assert 'total' in data['summary']
        assert 'by_status' in data['summary']
        assert 'by_type' in data['summary']


class TestAlertsAPIEndpoints:
    """Test alerts API endpoints"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_get_alerts_endpoint(self, mock_supabase, mock_profile, mock_jwt,
                                 client, mock_admin_token):
        """Test GET /api/alerts"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {
            'id': 'admin-123',
            'email': 'admin@test.com',
            'role': 'admin'
        }
        
        # Mock critical metrics
        mock_critical = Mock()
        mock_critical.data = [{
            'id': 'metric-critical',
            'asset_id': 'asset-123',
            'health_status': 'critical',
            'cpu_usage': 95.0,
            'last_updated': '2024-01-15T10:00:00Z',
            'asset': {
                'id': 'asset-123',
                'name': 'Critical Server',
                'type': 'hardware',
                'status': 'active'
            }
        }]
        
        # Mock warning metrics
        mock_warning = Mock()
        mock_warning.data = []
        
        # Mock problematic assets
        mock_assets = Mock()
        mock_assets.data = []
        
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        
        mock_table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.side_effect = [
            mock_critical,
            mock_warning
        ]
        mock_table.select.return_value.in_.return_value.execute.return_value = mock_assets
        
        response = client.get('/api/alerts',
                             headers={'Authorization': mock_admin_token})
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'alerts' in data
        assert 'count' in data


class TestRBACIntegration:
    """Test Role-Based Access Control integration"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    def test_viewer_cannot_create_asset(self, mock_profile, mock_jwt,
                                       client, mock_viewer_token):
        """Test viewer role cannot create assets"""
        mock_jwt.return_value = 'viewer-789'
        mock_profile.return_value = {
            'id': 'viewer-789',
            'email': 'viewer@test.com',
            'role': 'viewer'
        }
        
        response = client.post('/api/assets',
                              json={
                                  'name': 'Test Asset',
                                  'type': 'hardware',
                                  'status': 'active'
                              },
                              headers={'Authorization': mock_viewer_token})
        
        assert response.status_code == 403
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_operator_can_create_asset(self, mock_supabase, mock_profile, mock_jwt,
                                       client, mock_operator_token):
        """Test operator role can create assets"""
        mock_jwt.return_value = 'operator-456'
        mock_profile.return_value = {
            'id': 'operator-456',
            'email': 'operator@test.com',
            'role': 'operator'
        }
        
        mock_response = Mock()
        mock_response.data = [{'id': 'asset-new', 'name': 'Test Asset'}]
        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_response
        
        response = client.post('/api/assets',
                              json={
                                  'name': 'Test Asset',
                                  'type': 'hardware',
                                  'status': 'active'
                              },
                              headers={'Authorization': mock_operator_token})
        
        assert response.status_code == 201
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_admin_can_delete_incident(self, mock_supabase, mock_profile, mock_jwt,
                                       client, mock_admin_token):
        """Test admin role can delete incidents"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {
            'id': 'admin-123',
            'email': 'admin@test.com',
            'role': 'admin'
        }
        
        mock_response = Mock()
        mock_response.data = [{'id': 'incident-123'}]
        mock_supabase.table.return_value.delete.return_value.eq.return_value.execute.return_value = mock_response
        
        response = client.delete('/api/incidents/incident-123',
                                headers={'Authorization': mock_admin_token})
        
        assert response.status_code == 200


class TestErrorHandling:
    """Test error handling across API endpoints"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_database_error_handling(self, mock_supabase, mock_profile, mock_jwt,
                                    client, mock_admin_token):
        """Test graceful handling of database errors"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {
            'id': 'admin-123',
            'email': 'admin@test.com',
            'role': 'admin'
        }
        
        # Simulate database error
        mock_supabase.table.return_value.select.side_effect = Exception("Database connection failed")
        
        response = client.get('/api/assets',
                             headers={'Authorization': mock_admin_token})
        
        assert response.status_code == 500
        data = response.get_json()
        assert 'error' in data
    
    @patch('flask_jwt_extended.view_decorators.verify_jwt_in_request')
    def test_missing_authorization_header(self, mock_verify_jwt, client):
        """Test request without authorization header"""
        # Simulate JWT verification failure
        from flask_jwt_extended.exceptions import NoAuthorizationError
        mock_verify_jwt.side_effect = NoAuthorizationError("Missing Authorization Header")
        
        response = client.get('/api/assets')
        
        assert response.status_code == 401
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    def test_invalid_user_profile(self, mock_profile, mock_jwt, client):
        """Test request with invalid user profile"""
        mock_jwt.return_value = 'unknown-user'
        mock_profile.return_value = None
        
        response = client.get('/api/assets',
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 404
