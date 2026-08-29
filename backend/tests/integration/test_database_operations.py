"""
Integration tests for database operations
Tests Supabase database interactions with proper mocking
"""
import pytest
from unittest.mock import Mock, patch, call
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


class TestAssetDatabaseOperations:
    """Test asset database CRUD operations"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_create_asset_database_insert(self, mock_supabase, mock_profile, mock_jwt, client):
        """Test asset creation triggers database insert"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {
            'id': 'admin-123',
            'email': 'admin@test.com',
            'role': 'admin'
        }
        
        mock_response = Mock()
        mock_response.data = [{
            'id': 'asset-new',
            'name': 'New Asset',
            'type': 'hardware',
            'status': 'active'
        }]
        
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.insert.return_value.execute.return_value = mock_response
        
        asset_data = {
            'name': 'New Asset',
            'type': 'hardware',
            'status': 'active',
            'description': 'Test asset'
        }
        
        response = client.post('/api/assets',
                              json=asset_data,
                              headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 201
        
        # Verify database insert was called
        mock_supabase.table.assert_called_with('assets')
        mock_table.insert.assert_called_once()
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_update_asset_database_update(self, mock_supabase, mock_profile, mock_jwt, client):
        """Test asset update triggers database update"""
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
        updated_asset['name'] = 'New Name'
        
        mock_existing = Mock()
        mock_existing.data = existing_asset
        
        mock_update = Mock()
        mock_update.data = [updated_asset]
        
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_existing
        mock_table.update.return_value.eq.return_value.execute.return_value = mock_update
        
        response = client.put('/api/assets/asset-123',
                             json={'name': 'New Name'},
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
        
        # Verify database update was called
        mock_table.update.assert_called_once()
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_delete_asset_database_delete(self, mock_supabase, mock_profile, mock_jwt, client):
        """Test asset deletion triggers database delete"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {
            'id': 'admin-123',
            'email': 'admin@test.com',
            'role': 'admin'
        }
        
        mock_response = Mock()
        mock_response.data = [{'id': 'asset-123'}]
        
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.delete.return_value.eq.return_value.execute.return_value = mock_response
        
        response = client.delete('/api/assets/asset-123',
                                headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
        
        # Verify database delete was called
        mock_supabase.table.assert_called_with('assets')
        mock_table.delete.assert_called_once()
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_query_assets_with_filters(self, mock_supabase, mock_profile, mock_jwt, client):
        """Test querying assets with filters"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {
            'id': 'admin-123',
            'email': 'admin@test.com',
            'role': 'admin'
        }
        
        mock_response = Mock()
        mock_response.data = [
            {'id': 'asset-1', 'type': 'hardware', 'status': 'active'},
            {'id': 'asset-2', 'type': 'hardware', 'status': 'active'}
        ]
        
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value.execute.return_value = mock_response
        
        response = client.get('/api/assets',
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
        
        # Verify select was called
        mock_table.select.assert_called_once()


class TestIncidentDatabaseOperations:
    """Test incident database CRUD operations"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_create_incident_database_insert(self, mock_supabase, mock_profile, mock_jwt, client):
        """Test incident creation triggers database insert"""
        mock_jwt.return_value = 'viewer-789'
        mock_profile.return_value = {
            'id': 'viewer-789',
            'email': 'viewer@test.com',
            'role': 'viewer'
        }
        
        mock_response = Mock()
        mock_response.data = [{
            'id': 'incident-new',
            'title': 'New Incident',
            'description': 'Test incident',
            'severity': 'medium',
            'status': 'open',
            'reported_by': 'viewer-789'
        }]
        
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.insert.return_value.execute.return_value = mock_response
        
        incident_data = {
            'title': 'New Incident',
            'description': 'Test incident',
            'severity': 'medium'
        }
        
        response = client.post('/api/incidents',
                              json=incident_data,
                              headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 201
        
        # Verify database insert was called
        mock_supabase.table.assert_called_with('incidents')
        mock_table.insert.assert_called_once()
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_update_incident_status_database(self, mock_supabase, mock_profile, mock_jwt, client):
        """Test updating incident status triggers database update"""
        mock_jwt.return_value = 'operator-456'
        mock_profile.return_value = {
            'id': 'operator-456',
            'email': 'operator@test.com',
            'role': 'operator'
        }
        
        existing_incident = {
            'id': 'incident-123',
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
        
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_existing
        mock_table.update.return_value.eq.return_value.execute.return_value = mock_update
        
        response = client.put('/api/incidents/incident-123',
                             json={'status': 'in_progress'},
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
        
        # Verify update was called
        mock_table.update.assert_called_once()
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_query_incidents_with_ordering(self, mock_supabase, mock_profile, mock_jwt, client):
        """Test querying incidents with ordering"""
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
                'reporter': None,
                'assignee': None,
                'resolver': None,
                'asset': None
            },
            {
                'id': 'incident-2',
                'title': 'Issue 2',
                'reporter': None,
                'assignee': None,
                'resolver': None,
                'asset': None
            }
        ]
        
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value.order.return_value.order.return_value.execute.return_value = mock_response
        
        response = client.get('/api/incidents',
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
        
        # Verify ordering was applied
        mock_table.select.return_value.order.assert_called_once()


class TestMetricsDatabaseOperations:
    """Test metrics database operations"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_query_critical_metrics(self, mock_supabase, mock_profile, mock_jwt, client):
        """Test querying critical health status metrics"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {
            'id': 'admin-123',
            'email': 'admin@test.com',
            'role': 'admin'
        }
        
        mock_critical = Mock()
        mock_critical.data = [{
            'id': 'metric-1',
            'asset_id': 'asset-1',
            'health_status': 'critical',
            'cpu_usage': 95.0,
            'memory_usage': 70.0,
            'temperature': 85.0,
            'disk_usage': 80.0,
            'last_updated': '2024-01-15T10:00:00Z',
            'asset': {
                'id': 'asset-1',
                'name': 'Server',
                'type': 'hardware',
                'status': 'active'
            }
        }]
        
        mock_warning = Mock()
        mock_warning.data = []
        
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
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
        
        # Verify critical metrics were queried
        assert mock_table.select.call_count >= 1
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_query_asset_specific_metrics(self, mock_supabase, mock_profile, mock_jwt, client):
        """Test querying metrics for specific asset"""
        mock_jwt.return_value = 'operator-456'
        mock_profile.return_value = {
            'id': 'operator-456',
            'email': 'operator@test.com',
            'role': 'operator'
        }
        
        mock_response = Mock()
        mock_response.data = [
            {
                'id': 'metric-123',
                'asset_id': 'asset-123',
                'cpu_usage': 55.0,
                'memory_usage': 60.0,
                'health_status': 'healthy'
            }
        ]
        
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = mock_response
        
        response = client.get('/api/assets/asset-123/metrics',
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
        
        # Verify asset-specific query
        mock_table.select.return_value.eq.assert_called_once()


class TestDatabaseTransactions:
    """Test multi-step database transactions"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_create_asset_with_assignment(self, mock_supabase, mock_profile, mock_jwt, client):
        """Test creating asset with user assignment"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {
            'id': 'admin-123',
            'email': 'admin@test.com',
            'role': 'admin'
        }
        
        mock_response = Mock()
        mock_response.data = [{
            'id': 'asset-new',
            'name': 'Assigned Asset',
            'type': 'hardware',
            'status': 'active',
            'assigned_to': 'user-456',
            'created_by': 'admin-123'
        }]
        
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.insert.return_value.execute.return_value = mock_response
        
        response = client.post('/api/assets',
                              json={
                                  'name': 'Assigned Asset',
                                  'type': 'hardware',
                                  'status': 'active',
                                  'assigned_to': 'user-456'
                              },
                              headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 201
        data = response.get_json()
        
        # Verify assignment was included
        assert data['asset']['assigned_to'] == 'user-456'
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_resolve_incident_updates_fields(self, mock_supabase, mock_profile, mock_jwt, client):
        """Test resolving incident updates multiple fields"""
        mock_jwt.return_value = 'operator-456'
        mock_profile.return_value = {
            'id': 'operator-456',
            'email': 'operator@test.com',
            'role': 'operator'
        }
        
        existing_incident = {
            'id': 'incident-123',
            'status': 'in_progress',
            'reported_by': 'viewer-789',
            'assigned_to': 'operator-456',
            'resolved_by': None
        }
        
        resolved_incident = existing_incident.copy()
        resolved_incident['status'] = 'resolved'
        resolved_incident['resolved_by'] = 'operator-456'
        resolved_incident['resolution_notes'] = 'Fixed the issue'
        
        mock_existing = Mock()
        mock_existing.data = existing_incident
        
        mock_update = Mock()
        mock_update.data = [resolved_incident]
        
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_existing
        mock_table.update.return_value.eq.return_value.execute.return_value = mock_update
        
        response = client.put('/api/incidents/incident-123',
                             json={
                                 'status': 'resolved',
                                 'resolution_notes': 'Fixed the issue'
                             },
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200


class TestDatabaseRelationships:
    """Test database foreign key relationships"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_asset_with_creator_relationship(self, mock_supabase, mock_profile, mock_jwt, client):
        """Test asset query includes creator relationship"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {
            'id': 'admin-123',
            'email': 'admin@test.com',
            'role': 'admin'
        }
        
        mock_response = Mock()
        mock_response.data = [{
            'id': 'asset-1',
            'name': 'Asset 1',
            'creator': {
                'id': 'admin-123',
                'email': 'admin@test.com',
                'full_name': 'Admin User'
            }
        }]
        
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value.execute.return_value = mock_response
        
        response = client.get('/api/assets',
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
        
        # Verify relationship was queried
        # The select should include creator join
        args = mock_table.select.call_args
        if args and args[0]:
            select_query = args[0][0]
            # Check if query includes relationship
            assert 'creator' in select_query or '*' in select_query
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_incident_with_asset_relationship(self, mock_supabase, mock_profile, mock_jwt, client):
        """Test incident query includes asset relationship"""
        mock_jwt.return_value = 'viewer-789'
        mock_profile.return_value = {
            'id': 'viewer-789',
            'email': 'viewer@test.com',
            'role': 'viewer'
        }
        
        mock_response = Mock()
        mock_response.data = {
            'id': 'incident-123',
            'title': 'Asset Issue',
            'asset': {
                'id': 'asset-123',
                'name': 'Problem Asset',
                'type': 'hardware'
            }
        }
        
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response
        
        response = client.get('/api/incidents/incident-123',
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Verify asset relationship is included
        assert 'incident' in data
        assert 'asset' in data['incident']


class TestDatabaseErrorHandling:
    """Test database error scenarios"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_connection_timeout_handling(self, mock_supabase, mock_profile, mock_jwt, client):
        """Test handling of database connection timeout"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {
            'id': 'admin-123',
            'email': 'admin@test.com',
            'role': 'admin'
        }
        
        # Simulate timeout
        mock_supabase.table.return_value.select.side_effect = TimeoutError("Connection timeout")
        
        response = client.get('/api/assets',
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 500
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_constraint_violation_handling(self, mock_supabase, mock_profile, mock_jwt, client):
        """Test handling of database constraint violations"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {
            'id': 'admin-123',
            'email': 'admin@test.com',
            'role': 'admin'
        }
        
        # Simulate constraint violation
        mock_supabase.table.return_value.insert.side_effect = Exception("Constraint violation: invalid type")
        
        response = client.post('/api/assets',
                              json={
                                  'name': 'Test',
                                  'type': 'invalid_type',
                                  'status': 'active'
                              },
                              headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 500
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_empty_result_handling(self, mock_supabase, mock_profile, mock_jwt, client):
        """Test handling of empty database results"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {
            'id': 'admin-123',
            'email': 'admin@test.com',
            'role': 'admin'
        }
        
        mock_response = Mock()
        mock_response.data = []
        
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value.execute.return_value = mock_response
        
        response = client.get('/api/assets',
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['count'] == 0
        assert data['assets'] == []
