"""Unit Tests for CMDB Dependency Relationships, Topology & Blast Radius"""

import pytest
from unittest.mock import Mock, patch
from app import app
from app.services.relationship_service import RelationshipService

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

class TestRelationshipValidation:
    """Test relationship validation rules"""
    
    def test_self_loop_forbidden(self):
        rel, error, code = RelationshipService.create_relationship(
            parent_asset_id='asset-1',
            child_asset_id='asset-1',
            relationship_type='hosts'
        )
        assert code == 400
        assert "self-loop forbidden" in error

    def test_invalid_relationship_type(self):
        rel, error, code = RelationshipService.create_relationship(
            parent_asset_id='asset-1',
            child_asset_id='asset-2',
            relationship_type='invalid_type'
        )
        assert code == 400
        assert "Invalid relationship_type" in error

class TestRelationshipEndpoints:
    """Test CMDB REST endpoints"""

    @patch('app.get_jwt_identity')
    @patch('app.supabase')
    def test_get_asset_relationships(self, mock_supabase, mock_jwt, client):
        mock_jwt.return_value = 'user-123'
        mock_res = Mock()
        mock_res.data = []
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_res
        
        response = client.get('/api/assets/asset-123/relationships', headers={'Authorization': 'Bearer test-token'})
        assert response.status_code == 200
        data = response.get_json()
        assert 'outgoing' in data
        assert 'incoming' in data

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.supabase')
    def test_create_relationship_success(self, mock_supabase, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'admin-123'
        mock_profile.return_value = {'id': 'admin-123', 'role': 'it_admin'}
        
        # Mock asset existence checks and insert
        mock_asset = Mock()
        mock_asset.data = {'id': 'asset-1', 'name': 'Server 1', 'type': 'hardware', 'status': 'active'}
        
        mock_rel = Mock()
        mock_rel.data = [{
            'id': 'rel-1',
            'parent_asset_id': 'asset-1',
            'child_asset_id': 'asset-2',
            'relationship_type': 'hosts'
        }]
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_asset
        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_rel
        
        response = client.post('/api/assets/asset-1/relationships',
                               json={
                                   'child_asset_id': 'asset-2',
                                   'relationship_type': 'hosts',
                                   'description': 'Server hosts DB'
                               },
                               headers={'Authorization': 'Bearer test-token'})
        assert response.status_code == 201
        data = response.get_json()
        assert 'relationship' in data
        assert data['relationship']['relationship_type'] == 'hosts'

    @patch('app.get_jwt_identity')
    @patch('app.supabase')
    def test_blast_radius_calculation_endpoint(self, mock_supabase, mock_jwt, client):
        mock_jwt.return_value = 'user-123'
        
        mock_root = Mock()
        mock_root.data = {'id': 'asset-1', 'name': 'Core Switch', 'type': 'network', 'status': 'active'}
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_root
        
        mock_rpc = Mock()
        mock_rpc.data = [
            {
                'asset_id': 'asset-2',
                'asset_name': 'Production Server',
                'asset_type': 'hardware',
                'asset_status': 'active',
                'depth': 1,
                'impact_level': 'DIRECT_IMPACT',
                'relationship_type': 'connects_to'
            }
        ]
        mock_supabase.rpc.return_value.execute.return_value = mock_rpc
        
        response = client.get('/api/assets/asset-1/blast-radius', headers={'Authorization': 'Bearer test-token'})
        assert response.status_code == 200
        data = response.get_json()
        assert 'risk_level' in data
        assert 'summary' in data
        assert data['summary']['total_impacted'] == 1
        assert data['summary']['direct_impact'] == 1

    @patch('app.get_jwt_identity')
    @patch('app.supabase')
    def test_topology_graph_endpoint(self, mock_supabase, mock_jwt, client):
        mock_jwt.return_value = 'user-123'
        
        mock_root = Mock()
        mock_root.data = {'id': 'asset-1', 'name': 'Core Switch', 'type': 'network', 'status': 'active'}
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_root
        
        mock_empty_rel = Mock()
        mock_empty_rel.data = []
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_empty_rel
        
        mock_rpc = Mock()
        mock_rpc.data = []
        mock_supabase.rpc.return_value.execute.return_value = mock_rpc
        
        response = client.get('/api/assets/asset-1/topology', headers={'Authorization': 'Bearer test-token'})
        assert response.status_code == 200
        data = response.get_json()
        assert 'nodes' in data
        assert 'edges' in data
        assert len(data['nodes']) >= 1
        assert data['nodes'][0]['id'] == 'asset-1'
        assert data['nodes'][0]['data']['isRoot'] is True
