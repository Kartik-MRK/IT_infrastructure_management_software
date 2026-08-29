"""
Unit tests for Alert Generation functionality
Tests alert logic for critical/warning conditions, hardware metrics, peripherals
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
def critical_hardware_metric():
    """Critical hardware metric data"""
    return {
        'id': 'metric-123',
        'asset_id': 'asset-hw-001',
        'health_status': 'critical',
        'cpu_usage': 95.5,
        'memory_usage': 92.0,
        'temperature': 78.0,
        'disk_usage': 85.0,
        'last_updated': '2024-01-15T10:00:00Z',
        'asset': {
            'id': 'asset-hw-001',
            'name': 'Production Server',
            'type': 'hardware',
            'status': 'active'
        }
    }


@pytest.fixture
def warning_hardware_metric():
    """Warning hardware metric data"""
    return {
        'id': 'metric-456',
        'asset_id': 'asset-hw-002',
        'health_status': 'warning',
        'cpu_usage': 80.0,
        'memory_usage': 75.0,
        'temperature': 65.0,
        'disk_usage': 70.0,
        'last_updated': '2024-01-15T10:00:00Z',
        'asset': {
            'id': 'asset-hw-002',
            'name': 'Dev Server',
            'type': 'hardware',
            'status': 'active'
        }
    }


@pytest.fixture
def critical_peripheral_metric():
    """Critical peripheral metric data"""
    return {
        'id': 'metric-789',
        'asset_id': 'asset-per-001',
        'health_status': 'critical',
        'connection_status': 'disconnected',
        'print_status': 'offline',
        'peripheral_error': 'Device not responding',
        'last_updated': '2024-01-15T10:00:00Z',
        'asset': {
            'id': 'asset-per-001',
            'name': 'Office Printer',
            'type': 'peripherals',
            'status': 'active'
        }
    }


@pytest.fixture
def critical_network_metric():
    """Critical network metric data"""
    return {
        'id': 'metric-net-001',
        'asset_id': 'asset-net-001',
        'health_status': 'critical',
        'packet_loss_percent': 25.5,
        'latency_ms': 500.0,
        'last_updated': '2024-01-15T10:00:00Z',
        'asset': {
            'id': 'asset-net-001',
            'name': 'Main Router',
            'type': 'network',
            'status': 'active'
        }
    }


class TestAlertGeneration:
    """Test alert generation from metrics"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_generate_alerts_critical_hardware(self, mock_supabase, mock_profile, mock_jwt,
                                              client, mock_admin_profile, critical_hardware_metric):
        """Test generating alerts for critical hardware metrics"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = mock_admin_profile
        
        # Mock critical metrics response
        mock_critical = Mock()
        mock_critical.data = [critical_hardware_metric]
        
        # Mock warning metrics response
        mock_warning = Mock()
        mock_warning.data = []
        
        # Mock problematic assets response
        mock_assets = Mock()
        mock_assets.data = []
        
        # Configure mock chain for multiple queries
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        
        # First call: critical metrics
        mock_table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.side_effect = [
            mock_critical,  # Critical query
            mock_warning,   # Warning query
        ]
        
        # Third call: problematic assets
        mock_table.select.return_value.in_.return_value.execute.return_value = mock_assets
        
        response = client.get('/api/alerts',
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'alerts' in data
        assert len(data['alerts']) > 0
        
        # Check alert structure
        alert = data['alerts'][0]
        assert alert['severity'] == 'critical'
        assert 'CPU' in alert['message'] or 'Memory' in alert['message'] or 'Temp' in alert['message']
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_generate_alerts_warning_hardware(self, mock_supabase, mock_profile, mock_jwt,
                                             client, mock_operator_profile, warning_hardware_metric):
        """Test generating warning alerts for hardware"""
        mock_jwt.return_value = 'operator-456'
        mock_profile.return_value = mock_operator_profile
        
        mock_critical = Mock()
        mock_critical.data = []
        
        mock_warning = Mock()
        mock_warning.data = [warning_hardware_metric]
        
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
        data = response.get_json()
        assert 'alerts' in data
        
        if len(data['alerts']) > 0:
            alert = data['alerts'][0]
            assert alert['severity'] == 'warning'
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_generate_alerts_critical_peripheral(self, mock_supabase, mock_profile, mock_jwt,
                                                client, mock_admin_profile, critical_peripheral_metric):
        """Test generating alerts for critical peripheral status"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = mock_admin_profile
        
        mock_critical = Mock()
        mock_critical.data = [critical_peripheral_metric]
        
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
        data = response.get_json()
        assert 'alerts' in data
        assert len(data['alerts']) > 0
        
        alert = data['alerts'][0]
        assert alert['severity'] == 'critical'
        assert alert['asset_type'] == 'peripherals'
        assert 'Peripheral' in alert['message'] or 'Device' in alert['message']
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_generate_alerts_network_issues(self, mock_supabase, mock_profile, mock_jwt,
                                           client, mock_admin_profile, critical_network_metric):
        """Test generating alerts for network issues"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = mock_admin_profile
        
        mock_critical = Mock()
        mock_critical.data = [critical_network_metric]
        
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
        data = response.get_json()
        assert 'alerts' in data
        assert len(data['alerts']) > 0
        
        alert = data['alerts'][0]
        assert alert['severity'] == 'critical'
        assert 'packet loss' in alert['message'].lower()
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_generate_alerts_maintenance_assets(self, mock_supabase, mock_profile, mock_jwt,
                                               client, mock_operator_profile):
        """Test generating alerts for assets in maintenance status"""
        mock_jwt.return_value = 'operator-456'
        mock_profile.return_value = mock_operator_profile
        
        mock_critical = Mock()
        mock_critical.data = []
        
        mock_warning = Mock()
        mock_warning.data = []
        
        # Assets in maintenance
        mock_assets = Mock()
        mock_assets.data = [{
            'id': 'asset-maint-001',
            'name': 'Server 5',
            'type': 'hardware',
            'status': 'maintenance',
            'updated_at': '2024-01-15T10:00:00Z'
        }]
        
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
        data = response.get_json()
        assert 'alerts' in data
        assert len(data['alerts']) > 0
        
        alert = data['alerts'][0]
        assert alert['severity'] == 'warning'
        assert 'maintenance' in alert['message'].lower()
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_generate_alerts_damaged_assets(self, mock_supabase, mock_profile, mock_jwt,
                                           client, mock_admin_profile):
        """Test generating alerts for damaged assets"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = mock_admin_profile
        
        mock_critical = Mock()
        mock_critical.data = []
        
        mock_warning = Mock()
        mock_warning.data = []
        
        # Assets damaged
        mock_assets = Mock()
        mock_assets.data = [{
            'id': 'asset-dmg-001',
            'name': 'Laptop 3',
            'type': 'hardware',
            'status': 'damaged',
            'updated_at': '2024-01-15T10:00:00Z'
        }]
        
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
        data = response.get_json()
        assert 'alerts' in data
        assert len(data['alerts']) > 0
        
        alert = data['alerts'][0]
        assert 'damaged' in alert['message'].lower()


class TestAlertThresholds:
    """Test alert threshold logic"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_cpu_threshold_critical(self, mock_supabase, mock_profile, mock_jwt,
                                   client, mock_admin_profile):
        """Test CPU usage > 90% triggers critical alert"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = mock_admin_profile
        
        high_cpu_metric = {
            'id': 'metric-cpu',
            'asset_id': 'asset-cpu-001',
            'health_status': 'critical',
            'cpu_usage': 95.0,
            'memory_usage': 50.0,
            'temperature': 60.0,
            'disk_usage': 50.0,
            'last_updated': '2024-01-15T10:00:00Z',
            'asset': {
                'id': 'asset-cpu-001',
                'name': 'High CPU Server',
                'type': 'hardware',
                'status': 'active'
            }
        }
        
        mock_critical = Mock()
        mock_critical.data = [high_cpu_metric]
        
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
        data = response.get_json()
        
        alert = data['alerts'][0]
        assert 'CPU' in alert['message']
        assert '95' in alert['message']
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_temperature_threshold_critical(self, mock_supabase, mock_profile, mock_jwt,
                                           client, mock_admin_profile):
        """Test temperature > 75°C triggers critical alert"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = mock_admin_profile
        
        high_temp_metric = {
            'id': 'metric-temp',
            'asset_id': 'asset-temp-001',
            'health_status': 'critical',
            'cpu_usage': 50.0,
            'memory_usage': 50.0,
            'temperature': 82.0,
            'disk_usage': 50.0,
            'last_updated': '2024-01-15T10:00:00Z',
            'asset': {
                'id': 'asset-temp-001',
                'name': 'Hot Server',
                'type': 'hardware',
                'status': 'active'
            }
        }
        
        mock_critical = Mock()
        mock_critical.data = [high_temp_metric]
        
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
        data = response.get_json()
        
        alert = data['alerts'][0]
        assert 'Temp' in alert['message']
        assert '82' in alert['message']


class TestAlertFiltering:
    """Test alert filtering and retrieval"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_no_alerts_when_all_healthy(self, mock_supabase, mock_profile, mock_jwt,
                                       client, mock_operator_profile):
        """Test no alerts generated when all systems healthy"""
        mock_jwt.return_value = 'operator-456'
        mock_profile.return_value = mock_operator_profile
        
        mock_critical = Mock()
        mock_critical.data = []
        
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
        data = response.get_json()
        assert 'alerts' in data
        assert len(data['alerts']) == 0
        assert data['count'] == 0
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_alerts_count_matches_list_length(self, mock_supabase, mock_profile, mock_jwt,
                                             client, mock_admin_profile, critical_hardware_metric,
                                             warning_hardware_metric):
        """Test alert count matches actual alerts"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = mock_admin_profile
        
        mock_critical = Mock()
        mock_critical.data = [critical_hardware_metric]
        
        mock_warning = Mock()
        mock_warning.data = [warning_hardware_metric]
        
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
        data = response.get_json()
        assert data['count'] == len(data['alerts'])


class TestAlertEdgeCases:
    """Test edge cases and error handling"""
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_alerts_with_supabase_error(self, mock_supabase, mock_profile, mock_jwt,
                                       client, mock_admin_profile):
        """Test graceful handling of Supabase errors"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = mock_admin_profile
        
        # Mock Supabase to raise exception
        mock_supabase.table.return_value.select.side_effect = Exception("Database connection error")
        
        response = client.get('/api/alerts',
                             headers={'Authorization': 'Bearer test-token'})
        
        assert response.status_code == 500
        data = response.get_json()
        assert 'error' in data
    
    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_alerts_missing_asset_data(self, mock_supabase, mock_profile, mock_jwt,
                                      client, mock_admin_profile):
        """Test handling metrics with missing asset data"""
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = mock_admin_profile
        
        # Metric without asset data
        metric_no_asset = {
            'id': 'metric-no-asset',
            'asset_id': 'missing-asset',
            'health_status': 'critical',
            'cpu_usage': 95.0,
            'last_updated': '2024-01-15T10:00:00Z',
            'asset': None  # Missing asset
        }
        
        mock_critical = Mock()
        mock_critical.data = [metric_no_asset]
        
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
        
        # Should handle gracefully, skipping bad data
        assert response.status_code == 200
        data = response.get_json()
        # Alert may or may not be generated depending on implementation
        assert 'alerts' in data
