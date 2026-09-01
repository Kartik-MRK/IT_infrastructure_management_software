"""Unit & Integration Tests for Enterprise RBAC, Granular Permissions & Audit Logging"""

import pytest
from unittest.mock import Mock, patch
from app import app
from app.core.security import get_user_permissions, permission_required, role_required

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

class TestEnterprisePermissions:
    """Test permission resolution for enterprise personas"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    def test_admin_has_all_permissions(self, mock_profile, mock_jwt):
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {'id': 'admin-123', 'role': 'it_admin'}
        
        perms = get_user_permissions('admin-123')
        assert 'assets:create' in perms
        assert 'assets:delete' in perms
        assert 'admin:manage_roles' in perms
        assert 'security:view_audit_logs' in perms

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    def test_infrastructure_engineer_permissions(self, mock_profile, mock_jwt):
        mock_jwt.return_value = 'eng-123'
        mock_profile.return_value = {'id': 'eng-123', 'role': 'infrastructure_engineer'}
        
        perms = get_user_permissions('eng-123')
        assert 'assets:create' in perms
        assert 'assets:delete' in perms
        assert 'incidents:resolve' in perms
        assert 'admin:manage_roles' not in perms

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    def test_employee_requester_restricted_permissions(self, mock_profile, mock_jwt):
        mock_jwt.return_value = 'emp-123'
        mock_profile.return_value = {'id': 'emp-123', 'role': 'employee_requester'}
        
        perms = get_user_permissions('emp-123')
        assert 'assets:read_all' in perms
        assert 'incidents:create' in perms
        assert 'assets:create' not in perms
        assert 'assets:delete' not in perms

class TestEnterpriseRBACEndpoints:
    """Test RBAC endpoints (/api/roles, /api/departments, /api/audit-logs)"""
    
    @patch('app.get_jwt_identity')
    @patch('app.supabase')
    def test_get_roles_endpoint(self, mock_supabase, mock_jwt, client):
        mock_jwt.return_value = 'user-123'
        mock_response = Mock()
        mock_response.data = [
            {'id': 'it_admin', 'name': 'Global IT Administrator'},
            {'id': 'infrastructure_engineer', 'name': 'Infrastructure & Systems Engineer'}
        ]
        mock_supabase.table.return_value.select.return_value.order.return_value.execute.return_value = mock_response
        
        response = client.get('/api/roles', headers={'Authorization': 'Bearer test-token'})
        assert response.status_code == 200
        data = response.get_json()
        assert 'roles' in data
        assert len(data['roles']) == 2

    @patch('app.get_jwt_identity')
    @patch('app.supabase')
    def test_get_departments_endpoint(self, mock_supabase, mock_jwt, client):
        mock_jwt.return_value = 'user-123'
        mock_response = Mock()
        mock_response.data = [
            {'id': 'dept-1', 'name': 'Engineering', 'code': 'ENG'},
            {'id': 'dept-2', 'name': 'IT Operations', 'code': 'OPS'}
        ]
        mock_supabase.table.return_value.select.return_value.order.return_value.execute.return_value = mock_response
        
        response = client.get('/api/departments', headers={'Authorization': 'Bearer test-token'})
        assert response.status_code == 200
        data = response.get_json()
        assert 'departments' in data
        assert len(data['departments']) == 2

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_get_audit_logs_auditor_access(self, mock_supabase, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'auditor-123'
        mock_profile.return_value = {'id': 'auditor-123', 'role': 'security_auditor'}
        
        mock_response = Mock()
        mock_response.data = [
            {'id': 'audit-1', 'table_name': 'assets', 'action': 'UPDATE'}
        ]
        mock_supabase.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value = mock_response
        
        response = client.get('/api/audit-logs', headers={'Authorization': 'Bearer test-token'})
        assert response.status_code == 200
        data = response.get_json()
        assert 'audit_logs' in data

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    def test_get_audit_logs_viewer_forbidden(self, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'viewer-123'
        mock_profile.return_value = {'id': 'viewer-123', 'role': 'viewer'}
        
        response = client.get('/api/audit-logs', headers={'Authorization': 'Bearer test-token'})
        assert response.status_code == 403
