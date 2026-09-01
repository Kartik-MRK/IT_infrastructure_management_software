"""Unit Tests for Telemetry Ingestion, Statistical Anomaly Detection & Chaos Simulation"""

import pytest
from unittest.mock import Mock, patch
from app import app
from app.schemas.telemetry_schema import validate_telemetry_payload, validate_simulation_payload
from app.services.telemetry_service import TelemetryService

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

class TestTelemetrySchema:
    """Test validation of telemetry samples and chaos simulation payloads"""

    def test_valid_telemetry_payload(self):
        data = {
            'cpu_usage': 45.5,
            'memory_usage': 62.1,
            'disk_usage': 78.0,
            'latency_ms': 4.2,
            'error_rate_percent': 0.05,
            'bandwidth_usage_mbps': 250.0
        }
        cleaned, error = validate_telemetry_payload(data)
        assert error is None
        assert cleaned['cpu_usage'] == 45.5
        assert cleaned['latency_ms'] == 4.2

    def test_missing_required_metrics_rejection(self):
        cleaned, error = validate_telemetry_payload({'cpu_usage': 50.0})
        assert "required" in error

    def test_out_of_bounds_percentage_rejection(self):
        cleaned, error = validate_telemetry_payload({
            'cpu_usage': 150.0,
            'memory_usage': 50.0,
            'disk_usage': 50.0
        })
        assert "between 0.0 and 100.0" in error

    def test_valid_simulation_scenario(self):
        cleaned, error = validate_simulation_payload({'scenario': 'cpu_spike', 'target_asset_id': 'asset-1'})
        assert error is None
        assert cleaned['scenario'] == 'cpu_spike'
        assert cleaned['target_asset_id'] == 'asset-1'

    def test_invalid_simulation_scenario_rejection(self):
        cleaned, error = validate_simulation_payload({'scenario': 'apocalypse_explosion'})
        assert "Invalid scenario" in error

class TestTelemetryService:
    """Test Telemetry and Chaos simulation business logic"""

    @patch('app.services.telemetry_service.TelemetryRepository')
    def test_ingest_metric_success(self, mock_repo):
        mock_repo.ingest_and_evaluate.return_value = {
            'telemetry_id': 'tel-1',
            'is_anomaly': True,
            'anomaly_score': 3.8,
            'auto_incident_id': 'inc-99'
        }
        result, error, status = TelemetryService.ingest_metric(
            'asset-1',
            {'cpu_usage': 98.0, 'memory_usage': 70.0, 'disk_usage': 50.0}
        )
        assert status == 201
        assert result['is_anomaly'] is True
        assert result['anomaly_score'] == 3.8

    @patch('app.services.telemetry_service.TelemetryRepository')
    def test_simulate_telemetry_tick_with_cpu_spike(self, mock_repo):
        mock_repo.get_active_assets.return_value = [
            {'id': 'a-1', 'name': 'DB-Master', 'type': 'hardware'},
            {'id': 'a-2', 'name': 'Edge-Router', 'type': 'network'}
        ]
        mock_repo.ingest_and_evaluate.return_value = {'is_anomaly': True, 'anomaly_score': 3.9}

        result, error, status = TelemetryService.simulate_telemetry_tick({'scenario': 'cpu_spike'})
        assert status == 200
        assert result['simulated_count'] == 2
        assert result['scenario'] == 'cpu_spike'
        assert len(result['results']) == 2

class TestTelemetryEndpoints:
    """Test REST API endpoints for telemetry ingestion, history, and simulation"""

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.telemetry_service.TelemetryRepository')
    def test_ingest_telemetry_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'user-1'
        mock_profile.return_value = {'id': 'user-1', 'role': 'operator'}
        mock_repo.ingest_and_evaluate.return_value = {
            'telemetry_id': 't-123',
            'is_anomaly': False,
            'anomaly_score': 0.2
        }

        res = client.post('/api/assets/asset-1/telemetry',
                          json={'cpu_usage': 42.0, 'memory_usage': 55.0, 'disk_usage': 60.0},
                          headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 201
        data = res.get_json()
        assert data['result']['telemetry_id'] == 't-123'

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.telemetry_service.TelemetryRepository')
    def test_get_telemetry_history_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'user-1'
        mock_profile.return_value = {'id': 'user-1', 'role': 'viewer'}
        mock_repo.get_history.return_value = [
            {'id': '1', 'cpu_usage': 35.0, 'memory_usage': 60.0, 'is_anomaly': False},
            {'id': '2', 'cpu_usage': 98.0, 'memory_usage': 95.0, 'is_anomaly': True}
        ]

        res = client.get('/api/assets/asset-1/telemetry/history?limit=10',
                         headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['count'] == 2

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.telemetry_service.TelemetryRepository')
    def test_simulate_telemetry_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'admin-1'
        mock_profile.return_value = {'id': 'admin-1', 'role': 'admin'}
        mock_repo.get_active_assets.return_value = [{'id': 'a-1', 'type': 'hardware'}]
        mock_repo.ingest_and_evaluate.return_value = {'is_anomaly': False}

        res = client.post('/api/telemetry/simulate',
                          json={'scenario': 'normal'},
                          headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['simulated_count'] == 1

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.telemetry_service.TelemetryRepository')
    def test_get_anomaly_summary_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'user-1'
        mock_profile.return_value = {'id': 'user-1', 'role': 'viewer'}
        mock_repo.get_system_summary.return_value = {
            'total_telemetry_samples': 450,
            'total_anomalies_detected': 3,
            'affected_assets_count': 2
        }

        res = client.get('/api/telemetry/anomalies/summary',
                         headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['total_anomalies_detected'] == 3
