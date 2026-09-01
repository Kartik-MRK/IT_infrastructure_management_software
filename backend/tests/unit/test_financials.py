"""Unit Tests for Financial Lifecycle, TCO & Automated Depreciation Engine"""

import pytest
from unittest.mock import Mock, patch
from app import app
from app.services.financial_service import FinancialService

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

class TestDepreciationSchedules:
    """Test straight-line and declining balance depreciation formulas"""

    def test_straight_line_depreciation_schedule(self):
        # 10,000 cost, 1,000 salvage, 5 years useful life -> 1,800/year depreciation
        schedule = FinancialService._generate_depreciation_schedule(
            cost=10000.00,
            salvage_value=1000.00,
            useful_life_years=5,
            method='straight_line',
            purchase_date_str='2022-01-01'
        )
        assert len(schedule) == 5
        assert schedule[0]['depreciation_expense'] == 1800.00
        assert schedule[0]['ending_book_value'] == 8200.00
        assert schedule[4]['ending_book_value'] == 1000.00 # Reaches salvage
        assert schedule[4]['accumulated_depreciation'] == 9000.00

    def test_double_declining_balance_schedule(self):
        # 10,000 cost, 5 years life -> 40% rate per year
        schedule = FinancialService._generate_depreciation_schedule(
            cost=10000.00,
            salvage_value=1000.00,
            useful_life_years=5,
            method='double_declining',
            purchase_date_str='2022-01-01'
        )
        assert len(schedule) == 5
        assert schedule[0]['depreciation_expense'] == 4000.00
        assert schedule[0]['ending_book_value'] == 6000.00
        assert schedule[4]['ending_book_value'] >= 1000.00 # Doesn't go below salvage

    def test_zero_cost_asset_schedule(self):
        schedule = FinancialService._generate_depreciation_schedule(
            cost=0.00,
            salvage_value=0.00,
            useful_life_years=3,
            method='straight_line',
            purchase_date_str=None
        )
        assert len(schedule) == 3
        assert schedule[0]['ending_book_value'] == 0.00

class TestTCOAndHealthEvaluation:
    """Test Total Cost of Ownership calculations and health burden grading"""

    @patch('app.services.financial_service.AssetRepository')
    @patch('app.services.financial_service.FinancialRepository')
    def test_healthy_asset_tco(self, mock_fin_repo, mock_asset_repo):
        mock_asset_repo.get_by_id.return_value.data = {'id': 'a-1', 'name': 'Dell PowerEdge R750', 'type': 'hardware'}
        mock_fin_repo.get_asset_financials.return_value = {
            'asset_id': 'a-1',
            'purchase_cost': 5000.00,
            'salvage_value': 500.00,
            'useful_life_years': 5,
            'depreciation_method': 'straight_line',
            'maintenance_cost_total': 300.00,
            'license_cost_total': 0.00,
            'total_cost_of_ownership': 5300.00
        }
        mock_fin_repo.get_asset_maintenance_incidents.return_value.data = []

        data, err, status = FinancialService.get_asset_financial_breakdown('a-1')
        assert status == 200
        assert data['health_verdict'] == 'HEALTHY'
        assert data['financials']['total_cost_of_ownership'] == 5300.00

    @patch('app.services.financial_service.AssetRepository')
    @patch('app.services.financial_service.FinancialRepository')
    def test_replacement_recommended_high_maintenance_tco(self, mock_fin_repo, mock_asset_repo):
        mock_asset_repo.get_by_id.return_value.data = {'id': 'a-2', 'name': 'Aging Core Switch', 'type': 'network'}
        mock_fin_repo.get_asset_financials.return_value = {
            'asset_id': 'a-2',
            'purchase_cost': 1000.00,
            'salvage_value': 100.00,
            'useful_life_years': 5,
            'depreciation_method': 'straight_line',
            'maintenance_cost_total': 750.00, # 75% of purchase cost spent on repairs!
            'license_cost_total': 0.00,
            'total_cost_of_ownership': 1750.00
        }
        mock_fin_repo.get_asset_maintenance_incidents.return_value.data = [
            {'id': 'inc-1', 'title': 'Fan module replacement', 'maintenance_cost': 450.00},
            {'id': 'inc-2', 'title': 'Power supply burnout', 'maintenance_cost': 300.00}
        ]

        data, err, status = FinancialService.get_asset_financial_breakdown('a-2')
        assert status == 200
        assert data['health_verdict'] == 'REPLACEMENT_RECOMMENDED'
        assert len(data['maintenance_incidents']) == 2

class TestFinancialEndpoints:
    """Test REST API endpoints for single asset financials and executive summaries"""

    @patch('app.get_jwt_identity')
    @patch('app.services.financial_service.AssetRepository')
    @patch('app.services.financial_service.FinancialRepository')
    def test_get_asset_financials_endpoint(self, mock_fin_repo, mock_asset_repo, mock_jwt, client):
        mock_jwt.return_value = 'user-123'
        mock_asset_repo.get_by_id.return_value.data = {'id': 'a-1', 'name': 'MacBook Pro M3'}
        mock_fin_repo.get_asset_financials.return_value = {
            'asset_id': 'a-1',
            'purchase_cost': 2500.00,
            'salvage_value': 500.00,
            'current_book_value': 1700.00,
            'total_cost_of_ownership': 2500.00
        }
        mock_fin_repo.get_asset_maintenance_incidents.return_value.data = []

        res = client.get('/api/assets/a-1/financials', headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert 'financials' in data
        assert data['financials']['current_book_value'] == 1700.00
        assert 'depreciation_schedule' in data

    @patch('app.get_jwt_identity')
    @patch('app.services.financial_service.FinancialRepository')
    def test_get_executive_summary_endpoint(self, mock_fin_repo, mock_jwt, client):
        mock_jwt.return_value = 'user-123'
        mock_fin_repo.get_executive_summary.return_value = {
            'overview': {
                'total_capitalized_investment': 959500.00,
                'total_current_book_value': 322745.00,
                'total_infrastructure_tco': 959500.00
            },
            'by_type': {
                'hardware': {'total_cost': 563000.00}
            }
        }

        res = client.get('/api/financials/executive-summary', headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['overview']['total_capitalized_investment'] == 959500.00

    @patch('app.get_jwt_identity')
    @patch('app.services.financial_service.FinancialRepository')
    def test_get_depreciation_forecast_endpoint(self, mock_fin_repo, mock_jwt, client):
        mock_jwt.return_value = 'user-123'
        mock_res = Mock()
        mock_res.data = [
            {
                'id': 'a-1',
                'cost': 10000.00,
                'salvage_value': 1000.00,
                'useful_life_years': 5,
                'depreciation_method': 'straight_line',
                'purchase_date': '2024-01-01'
            }
        ]
        mock_fin_repo.get_all_active_assets.return_value = mock_res

        res = client.get('/api/financials/depreciation-forecast', headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert 'forecast' in data
        assert len(data['forecast']) == 5
