"""Unit Tests for Service Level Agreement (SLA) Engine & Breach Timers"""

import pytest
from unittest.mock import Mock, patch
from app import app
from app.schemas.sla_schema import validate_sla_policy_payload
from app.services.sla_service import SLAService

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

class TestSLASchemaValidation:
    """Test payload validation for SLA policy configuration"""

    def test_valid_policy_payload(self):
        data = {
            'policy_name': 'P1 Outage Fast Response',
            'severity': 'critical',
            'max_response_time_minutes': 10,
            'max_resolution_time_minutes': 60,
            'business_hours_only': False,
            'escalation_email': 'sre@enterprise.local'
        }
        cleaned, error = validate_sla_policy_payload(data)
        assert error is None
        assert cleaned['max_response_time_minutes'] == 10
        assert cleaned['max_resolution_time_minutes'] == 60
        assert cleaned['severity'] == 'critical'

    def test_invalid_negative_duration_rejection(self):
        cleaned, error = validate_sla_policy_payload({'max_response_time_minutes': -15})
        assert "greater than 0" in error

    def test_invalid_severity_rejection(self):
        cleaned, error = validate_sla_policy_payload({'severity': 'catastrophic_mega_danger'})
        assert "Invalid severity" in error

class TestSLAServiceLogic:
    """Test SLA service business logic and role authorization"""

    @patch('app.services.sla_service.SLARepository')
    def test_update_policy_forbidden_for_viewer(self, mock_repo):
        result, error, status = SLAService.update_policy(
            policy_id='pol-1',
            data={'max_response_time_minutes': 20},
            user_profile={'role': 'viewer'}
        )
        assert status == 403
        assert "Only administrators" in error

    @patch('app.services.sla_service.SLARepository')
    def test_acknowledge_incident_success(self, mock_repo):
        mock_repo.record_first_response.return_value = (
            {'id': 'inc-1', 'first_responded_at': '2026-09-01T10:00:00Z', 'sla_response_breached': False},
            None
        )
        result, error, status = SLAService.acknowledge_incident('inc-1', 'user-1')
        assert status == 200
        assert result['sla_response_breached'] is False

class TestSLAEndpoints:
    """Test REST API endpoints for SLA policies and timers"""

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.sla_service.SLARepository')
    def test_list_sla_policies_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'user-1'
        mock_profile.return_value = {'id': 'user-1', 'role': 'operator'}
        mock_res = Mock()
        mock_res.data = [
            {'id': 'p1', 'severity': 'critical', 'max_response_time_minutes': 15},
            {'id': 'p2', 'severity': 'high', 'max_response_time_minutes': 60}
        ]
        mock_repo.get_all_policies.return_value = mock_res

        res = client.get('/api/sla/policies', headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert len(data['policies']) == 2

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.sla_service.SLARepository')
    def test_update_policy_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'admin-1'
        mock_profile.return_value = {'id': 'admin-1', 'role': 'admin'}
        mock_existing = Mock()
        mock_existing.data = {'id': 'pol-1', 'severity': 'critical'}
        mock_repo.get_policy_by_id.return_value = mock_existing

        mock_update = Mock()
        mock_update.data = [{'id': 'pol-1', 'severity': 'critical', 'max_response_time_minutes': 10}]
        mock_repo.update_policy.return_value = mock_update

        res = client.put('/api/sla/policies/pol-1',
                         json={'max_response_time_minutes': 10},
                         headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['policy']['max_response_time_minutes'] == 10

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.sla_service.SLARepository')
    def test_acknowledge_incident_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'user-1'
        mock_profile.return_value = {'id': 'user-1', 'role': 'technician'}
        mock_repo.record_first_response.return_value = (
            {'id': 'inc-100', 'first_responded_at': '2026-09-01T12:00:00Z'},
            None
        )

        res = client.post('/api/incidents/inc-100/acknowledge',
                          headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['incident']['id'] == 'inc-100'

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.sla_service.SLARepository')
    def test_get_sla_summary_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'user-1'
        mock_profile.return_value = {'id': 'user-1', 'role': 'viewer'}
        mock_repo.get_sla_compliance_summary.return_value = {
            'total_incidents': 25,
            'resolved_incidents': 20,
            'resolved_within_sla': 19,
            'sla_compliance_percentage': 95.0,
            'avg_mttr_minutes': 85.4
        }

        res = client.get('/api/sla/summary', headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['sla_compliance_percentage'] == 95.0
