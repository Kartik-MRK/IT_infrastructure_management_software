"""Unit Tests for Asset Bulk Operations & Batch Management"""

import pytest
from unittest.mock import Mock, patch
from app import app
from app.services.asset_service import AssetService

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

class TestAssetBulkOperations:
    """Test bulk update and delete service logic"""

    @patch('app.services.asset_service.AssetRepository')
    def test_bulk_update_status_success(self, mock_repo):
        mock_repo.bulk_update_status.return_value = Mock(data=[{'id': '1'}, {'id': '2'}])
        res, error, status = AssetService.bulk_update_status(['id-1', 'id-2'], 'maintenance')
        assert status == 200
        assert res['updated_count'] == 2
        assert res['status'] == 'maintenance'

    def test_bulk_update_status_invalid_status(self):
        res, error, status = AssetService.bulk_update_status(['id-1'], 'exploding')
        assert status == 400
        assert "Invalid status" in error

    def test_bulk_update_status_empty_list(self):
        res, error, status = AssetService.bulk_update_status([], 'active')
        assert status == 400

    @patch('app.services.asset_service.AssetRepository')
    def test_bulk_delete_success(self, mock_repo):
        mock_repo.bulk_delete.return_value = Mock(data=[])
        res, error, status = AssetService.bulk_delete(['id-1', 'id-2'])
        assert status == 200
        assert res['deleted_count'] == 2

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.asset_service.AssetRepository')
    def test_bulk_status_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'admin-user'
        mock_profile.return_value = {'id': 'admin-user', 'role': 'admin'}
        mock_repo.bulk_update_status.return_value = Mock(data=[])

        res = client.post('/api/assets/bulk-status',
                          json={'asset_ids': ['a1', 'a2'], 'status': 'maintenance'},
                          headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['updated_count'] == 2
