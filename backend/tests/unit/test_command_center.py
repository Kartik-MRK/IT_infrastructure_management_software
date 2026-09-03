"""Unit Tests for Executive Analytics & SRE Command Center"""

import pytest
from unittest.mock import Mock, patch
from app import app
from app.services.command_center_service import CommandCenterService

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

class TestCommandCenterService:
    """Test Command Center service logic and metrics retrieval"""

    @patch('app.services.command_center_service.CommandCenterRepository')
    def test_get_metrics_success(self, mock_repo):
        mock_repo.get_command_center_metrics.return_value = {
            'composite_health_index': 92,
            'health_tier': 'EXCELLENT',
            'financial_tco': {'total_asset_valuation': 500000},
            'sre_reliability': {'mttr_minutes': 35.0, 'sla_uptime_percent': 99.98}
        }
        res, error, status = CommandCenterService.get_metrics()
        assert status == 200
        assert res['composite_health_index'] == 92
        assert res['health_tier'] == 'EXCELLENT'

    @patch('app.services.command_center_service.CommandCenterRepository')
    def test_get_metrics_database_error(self, mock_repo):
        mock_repo.get_command_center_metrics.side_effect = Exception("DB Connection Timeout")
        res, error, status = CommandCenterService.get_metrics()
        assert status == 500
        assert "Failed to retrieve executive command center metrics" in error

class TestCommandCenterEndpoints:
    """Test REST API endpoint for command center metrics"""

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.command_center_service.CommandCenterRepository')
    def test_command_center_metrics_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'exec-user-1'
        mock_profile.return_value = {'id': 'exec-user-1', 'role': 'admin'}
        mock_repo.get_command_center_metrics.return_value = {
            'composite_health_index': 88,
            'health_tier': 'EXCELLENT',
            'financial_tco': {'total_asset_valuation': 1200000}
        }

        res = client.get('/api/command-center/metrics',
                         headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['command_center']['composite_health_index'] == 88
