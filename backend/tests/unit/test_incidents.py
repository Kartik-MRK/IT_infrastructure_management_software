"""
Unit tests for Incident Management functionality
Tests incident creation, updates, status transitions, and validation
"""
import pytest
from unittest.mock import Mock, patch
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
def mock_admin_profile():
    """Mock admin user profile"""
    return {
        'id': 'admin-123',
        'email': 'admin@test.com',
        'full_name': 'Test Admin',
        'role': 'admin'
    }


@pytest.fixture
def mock_operator_profile():
    """Mock operator user profile"""
    return {
        'id': 'operator-456',
        'email': 'operator@test.com',
        'full_name': 'Test Operator',
        'role': 'operator'
    }


@pytest.fixture
def mock_viewer_profile():
    """Mock viewer user profile"""
    return {
        'id': 'viewer-789',
        'email': 'viewer@test.com',
        'full_name': 'Test Viewer',
        'role': 'viewer'
    }


@pytest.fixture
def sample_incident():
    """Sample incident data"""
    return {
        'id': 'incident-123',
        'title': 'Server Down',
        'description': 'Production server not responding',
        'severity': 'critical',
        'status': 'open',
        'category': 'infrastructure',
        'asset_id': 'asset-123',
        'reported_by': 'viewer-789',
        'assigned_to': None,
        'resolved_by': None,
        'reported_at': '2024-01-15T10:00:00Z',
        'resolved_at': None,
        'resolution_notes': None,
        'priority': 9,
        'created_at': '2024-01-15T10:00:00Z',
        'updated_at': '2024-01-15T10:00:00Z'
    }


class TestIncidentCreation:
    """Test incident creation logic"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_create_incident_success(self, mock_supabase, mock_profile, mock_jwt,
                                     client, mock_viewer_profile, sample_incident):
        """Test successful incident creation"""
        mock_jwt.return_value = 'viewer-789'
        mock_profile.return_value = mock_viewer_profile
        
        mock_response = Mock()
        mock_response.data = [sample_incident]
        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_response
        
        response = client.post('/api/incidents',
                              json={
                                  'title': 'Server Down',
                                  'description': 'Production server not responding',
                                  'severity': 'critical',
                                  'category': 'infrastructure',
                                  'asset_id': 'asset-123'
                              },
                              headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 201
        data = response.get_json()
        assert 'incident' in data
        assert data['incident']['title'] == 'Server Down'
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_create_incident_without_asset(self, mock_supabase, mock_profile, mock_jwt,
                                          client, mock_operator_profile, sample_incident):
        """Test creating incident without asset association"""
        mock_jwt.return_value = 'operator-456'
        mock_profile.return_value = mock_operator_profile
        
        incident_no_asset = sample_incident.copy()
        incident_no_asset['asset_id'] = None
        
        mock_response = Mock()
        mock_response.data = [incident_no_asset]
        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_response
        
        response = client.post('/api/incidents',
                              json={
                                  'title': 'General Network Issue',
                                  'description': 'Network slow across building',
                                  'severity': 'medium',
                                  'category': 'network'
                              },
                              headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 201
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    def test_create_incident_missing_required_fields(self, mock_profile, mock_jwt,
                                                     client, mock_viewer_profile):
        """Test incident creation with missing required fields"""
        mock_jwt.return_value = 'viewer-789'
        mock_profile.return_value = mock_viewer_profile
        
        # Missing 'description'
        response = client.post('/api/incidents',
                              json={
                                  'title': 'Test Incident',
                                  'severity': 'low'
                              },
                              headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    def test_create_incident_missing_title(self, mock_profile, mock_jwt,
                                          client, mock_viewer_profile):
        """Test incident creation with missing title"""
        mock_jwt.return_value = 'viewer-789'
        mock_profile.return_value = mock_viewer_profile
        
        response = client.post('/api/incidents',
                              json={
                                  'description': 'Something went wrong',
                                  'severity': 'medium'
                              },
                              headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 400
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    def test_create_incident_invalid_severity(self, mock_profile, mock_jwt,
                                              client, mock_operator_profile):
        """Test incident creation with invalid severity"""
        mock_jwt.return_value = 'operator-456'
        mock_profile.return_value = mock_operator_profile
        
        response = client.post('/api/incidents',
                              json={
                                  'title': 'Test Incident',
                                  'description': 'Test description',
                                  'severity': 'invalid_severity'
                              },
                              headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code in [400, 500]  # DB constraint will reject


class TestIncidentRetrieval:
    """Test incident retrieval operations"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_get_all_incidents(self, mock_supabase, mock_profile, mock_jwt,
                              client, mock_operator_profile, sample_incident):
        """Test retrieving all incidents"""
        mock_jwt.return_value = 'operator-456'
        mock_profile.return_value = mock_operator_profile

        # Create incident with proper nested structures (not MagicMock)
        incident_data = sample_incident.copy()
        incident_data['reporter'] = {'id': 'viewer-789', 'email': 'viewer@test.com', 'full_name': 'Test Viewer'}
        incident_data['assignee'] = None
        incident_data['resolver'] = None
        incident_data['asset'] = {'id': 'asset-123', 'name': 'Test Asset', 'type': 'hardware'}

        mock_response = Mock()
        mock_response.data = [incident_data]
        mock_supabase.table.return_value.select.return_value.order.return_value.order.return_value.execute.return_value = mock_response
        
        response = client.get('/api/incidents',
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'incidents' in data
        assert 'count' in data
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_get_single_incident(self, mock_supabase, mock_profile, mock_jwt,
                                client, mock_viewer_profile, sample_incident):
        """Test retrieving a single incident by ID"""
        mock_jwt.return_value = 'viewer-789'
        mock_profile.return_value = mock_viewer_profile
        
        mock_response = Mock()
        mock_response.data = sample_incident
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response
        
        response = client.get('/api/incidents/incident-123',
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'incident' in data
        assert data['incident']['id'] == 'incident-123'
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_get_nonexistent_incident(self, mock_supabase, mock_profile, mock_jwt,
                                     client, mock_admin_profile):
        """Test retrieving a non-existent incident"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = mock_admin_profile
        
        mock_response = Mock()
        mock_response.data = None
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response
        
        response = client.get('/api/incidents/nonexistent-id',
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 404


class TestIncidentUpdate:
    """Test incident update operations"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_update_incident_status_by_reporter(self, mock_supabase, mock_profile, mock_jwt,
                                                client, mock_viewer_profile, sample_incident):
        """Test updating incident status by reporter"""
        mock_jwt.return_value = 'viewer-789'
        mock_profile.return_value = mock_viewer_profile
        
        # Mock existing incident
        mock_existing = Mock()
        mock_existing.data = sample_incident
        
        # Mock update
        updated_incident = sample_incident.copy()
        updated_incident['status'] = 'in_progress'
        mock_update = Mock()
        mock_update.data = [updated_incident]
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_existing
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update
        
        response = client.put('/api/incidents/incident-123',
                             json={'status': 'in_progress'},
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_update_incident_assign_by_admin(self, mock_supabase, mock_profile, mock_jwt,
                                            client, mock_admin_profile, sample_incident):
        """Test admin assigning incident to operator"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = mock_admin_profile
        
        mock_existing = Mock()
        mock_existing.data = sample_incident
        
        updated_incident = sample_incident.copy()
        updated_incident['assigned_to'] = 'operator-456'
        mock_update = Mock()
        mock_update.data = [updated_incident]
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_existing
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update
        
        response = client.put('/api/incidents/incident-123',
                             json={'assigned_to': 'operator-456'},
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_update_incident_resolve_with_notes(self, mock_supabase, mock_profile, mock_jwt,
                                               client, mock_operator_profile, sample_incident):
        """Test resolving incident with resolution notes"""
        mock_jwt.return_value = 'operator-456'
        mock_profile.return_value = mock_operator_profile
        
        # Make operator the assignee
        incident_assigned = sample_incident.copy()
        incident_assigned['assigned_to'] = 'operator-456'
        
        mock_existing = Mock()
        mock_existing.data = incident_assigned
        
        resolved_incident = incident_assigned.copy()
        resolved_incident['status'] = 'resolved'
        resolved_incident['resolution_notes'] = 'Restarted server, issue fixed'
        resolved_incident['resolved_by'] = 'operator-456'
        
        mock_update = Mock()
        mock_update.data = [resolved_incident]
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_existing
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update
        
        response = client.put('/api/incidents/incident-123',
                             json={
                                 'status': 'resolved',
                                 'resolution_notes': 'Restarted server, issue fixed'
                             },
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_update_incident_unauthorized_user(self, mock_supabase, mock_profile, mock_jwt,
                                              client, mock_viewer_profile, sample_incident):
        """Test unauthorized user cannot update others' incidents"""
        mock_jwt.return_value = 'viewer-999'  # Different user
        mock_profile.return_value = {
            'id': 'viewer-999',
            'email': 'other@test.com',
            'role': 'viewer'
        }
        
        mock_existing = Mock()
        mock_existing.data = sample_incident  # Reported by viewer-789
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_existing
        
        response = client.put('/api/incidents/incident-123',
                             json={'status': 'closed'},
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 403
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    def test_update_incident_invalid_status(self, mock_profile, mock_jwt,
                                           client, mock_admin_profile):
        """Test updating incident with invalid status"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = mock_admin_profile
        
        response = client.put('/api/incidents/incident-123',
                             json={'status': 'invalid_status'},
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code in [400, 404]  # Bad request or not found


class TestIncidentStatusTransitions:
    """Test incident status transition logic"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_transition_open_to_in_progress(self, mock_supabase, mock_profile, mock_jwt,
                                           client, mock_operator_profile, sample_incident):
        """Test transitioning from open to in_progress"""
        mock_jwt.return_value = 'operator-456'
        mock_profile.return_value = mock_operator_profile
        
        incident = sample_incident.copy()
        incident['assigned_to'] = 'operator-456'
        incident['status'] = 'open'
        
        mock_existing = Mock()
        mock_existing.data = incident
        
        updated = incident.copy()
        updated['status'] = 'in_progress'
        mock_update = Mock()
        mock_update.data = [updated]
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_existing
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update
        
        response = client.put('/api/incidents/incident-123',
                             json={'status': 'in_progress'},
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_transition_in_progress_to_resolved(self, mock_supabase, mock_profile, mock_jwt,
                                               client, mock_operator_profile, sample_incident):
        """Test transitioning from in_progress to resolved"""
        mock_jwt.return_value = 'operator-456'
        mock_profile.return_value = mock_operator_profile
        
        incident = sample_incident.copy()
        incident['assigned_to'] = 'operator-456'
        incident['status'] = 'in_progress'
        
        mock_existing = Mock()
        mock_existing.data = incident
        
        updated = incident.copy()
        updated['status'] = 'resolved'
        updated['resolved_by'] = 'operator-456'
        mock_update = Mock()
        mock_update.data = [updated]
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_existing
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update
        
        response = client.put('/api/incidents/incident-123',
                             json={'status': 'resolved'},
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200


class TestIncidentDelete:
    """Test incident deletion operations"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_delete_incident_admin(self, mock_supabase, mock_profile, mock_jwt,
                                  client, mock_admin_profile):
        """Test incident deletion by admin"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = mock_admin_profile
        
        mock_response = Mock()
        mock_response.data = [{'id': 'incident-123'}]
        mock_supabase.table.return_value.delete.return_value.eq.return_value.execute.return_value = mock_response
        
        response = client.delete('/api/incidents/incident-123',
                                headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    def test_delete_incident_forbidden_non_admin(self, mock_profile, mock_jwt,
                                                 client, mock_operator_profile):
        """Test incident deletion forbidden for non-admin"""
        mock_jwt.return_value = 'operator-456'
        mock_profile.return_value = mock_operator_profile
        
        response = client.delete('/api/incidents/incident-123',
                                headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 403


class TestIncidentValidation:
    """Test incident data validation"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    def test_create_incident_invalid_category(self, mock_profile, mock_jwt,
                                              client, mock_viewer_profile):
        """Test creating incident with invalid category"""
        mock_jwt.return_value = 'viewer-789'
        mock_profile.return_value = mock_viewer_profile
        
        response = client.post('/api/incidents',
                              json={
                                  'title': 'Test',
                                  'description': 'Test description',
                                  'severity': 'low',
                                  'category': 'invalid_category'
                              },
                              headers={'Authorization': 'Bearer test-token'})
        
        # DB constraint should reject
        assert response.status_code in [400, 500]
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_create_incident_with_priority(self, mock_supabase, mock_profile, mock_jwt,
                                          client, mock_operator_profile, sample_incident):
        """Test creating incident with priority level"""
        mock_jwt.return_value = 'operator-456'
        mock_profile.return_value = mock_operator_profile
        
        incident_with_priority = sample_incident.copy()
        incident_with_priority['priority'] = 8
        
        mock_response = Mock()
        mock_response.data = [incident_with_priority]
        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_response
        
        response = client.post('/api/incidents',
                              json={
                                  'title': 'High Priority Issue',
                                  'description': 'Critical production issue',
                                  'severity': 'critical',
                                  'priority': 8
                              },
                              headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 201


class TestIncidentEdgeCases:
    """Test edge cases and boundary conditions"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_update_nonexistent_incident(self, mock_supabase, mock_profile, mock_jwt,
                                        client, mock_admin_profile):
        """Test updating a non-existent incident"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = mock_admin_profile
        
        mock_response = Mock()
        mock_response.data = None
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response
        
        response = client.put('/api/incidents/nonexistent-id',
                             json={'status': 'resolved'},
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 404
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_create_incident_with_long_description(self, mock_supabase, mock_profile, mock_jwt,
                                                   client, mock_viewer_profile, sample_incident):
        """Test creating incident with very long description"""
        mock_jwt.return_value = 'viewer-789'
        mock_profile.return_value = mock_viewer_profile
        
        long_description = "A" * 5000  # Very long text
        
        incident = sample_incident.copy()
        incident['description'] = long_description
        
        mock_response = Mock()
        mock_response.data = [incident]
        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_response
        
        response = client.post('/api/incidents',
                              json={
                                  'title': 'Test',
                                  'description': long_description,
                                  'severity': 'low'
                              },
                              headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 201
