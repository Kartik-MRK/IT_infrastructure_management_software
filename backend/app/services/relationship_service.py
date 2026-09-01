"""Relationship Service for CMDB Topology & Blast Radius Computation"""

from ..repositories.relationship_repository import RelationshipRepository
from ..repositories.asset_repository import AssetRepository

VALID_RELATIONSHIP_TYPES = {'hosts', 'connects_to', 'depends_on', 'backs_up'}

class RelationshipService:
    """Business logic for asset dependency modeling, topology graphing, and blast radius"""
    
    @staticmethod
    def get_relationships_for_asset(asset_id):
        """Fetch incoming and outgoing dependencies for an asset"""
        return RelationshipRepository.get_for_asset(asset_id)
        
    @staticmethod
    def create_relationship(parent_asset_id, child_asset_id, relationship_type, description=None, user_id=None):
        """Validate and create a graph dependency edge"""
        if not parent_asset_id or not child_asset_id:
            return None, "parent_asset_id and child_asset_id are required", 400
            
        if parent_asset_id == child_asset_id:
            return None, "An asset cannot have a relationship with itself (self-loop forbidden)", 400
            
        rel_type = str(relationship_type).strip().lower()
        if rel_type not in VALID_RELATIONSHIP_TYPES:
            return None, f"Invalid relationship_type. Must be one of: {', '.join(sorted(VALID_RELATIONSHIP_TYPES))}", 400
            
        # Verify both assets exist
        parent_res = AssetRepository.get_by_id(parent_asset_id)
        if not parent_res.data:
            return None, f"Parent asset '{parent_asset_id}' does not exist", 404
            
        child_res = AssetRepository.get_by_id(child_asset_id)
        if not child_res.data:
            return None, f"Child asset '{child_asset_id}' does not exist", 404
            
        try:
            res = RelationshipRepository.create(parent_asset_id, child_asset_id, rel_type, description, user_id)
            if res.data and len(res.data) > 0:
                return res.data[0], None, 201
            return None, "Failed to record relationship in database", 500
        except Exception as e:
            err_msg = str(e)
            if "uq_asset_relationship" in err_msg or "duplicate key" in err_msg:
                return None, "This relationship already exists between these assets", 409
            return None, err_msg, 500
            
    @staticmethod
    def delete_relationship(relationship_id):
        """Remove a dependency relationship"""
        res = RelationshipRepository.delete(relationship_id)
        return True, "Relationship deleted successfully", 200
        
    @staticmethod
    def get_blast_radius(asset_id, max_depth=5):
        """Compute downstream impact when root asset experiences an outage"""
        root_res = AssetRepository.get_by_id(asset_id)
        if not root_res.data:
            return None, "Asset not found", 404
            
        root_asset = root_res.data
        impacted_records = RelationshipRepository.calculate_blast_radius(asset_id, max_depth=max_depth)
        
        # Risk assessment logic
        total_impacted = len(impacted_records)
        direct_count = sum(1 for item in impacted_records if item.get('depth') == 1)
        secondary_count = sum(1 for item in impacted_records if item.get('depth') == 2)
        tertiary_count = sum(1 for item in impacted_records if item.get('depth', 0) >= 3)
        
        # Determine risk severity grade
        if total_impacted >= 5 or any(item.get('asset_type') in ['infrastructure', 'network'] for item in impacted_records):
            risk_level = 'CRITICAL'
        elif total_impacted >= 2:
            risk_level = 'HIGH'
        elif total_impacted == 1:
            risk_level = 'MEDIUM'
        else:
            risk_level = 'LOW'
            
        return {
            'root_asset': {
                'id': root_asset['id'],
                'name': root_asset['name'],
                'type': root_asset['type'],
                'status': root_asset['status']
            },
            'risk_level': risk_level,
            'summary': {
                'total_impacted': total_impacted,
                'direct_impact': direct_count,
                'secondary_impact': secondary_count,
                'tertiary_impact': tertiary_count
            },
            'impacted_assets': impacted_records
        }, None, 200

    @staticmethod
    def get_topology(asset_id=None):
        """
        Generate React Flow-compliant graph nodes and edges.
        If asset_id is provided, returns subgraph centered on that asset with blast radius.
        If asset_id is None, returns global infrastructure topology.
        """
        if asset_id:
            root_res = AssetRepository.get_by_id(asset_id)
            if not root_res.data:
                return None, "Asset not found", 404
                
            root = root_res.data
            direct_rels = RelationshipRepository.get_for_asset(asset_id)
            blast_data, _, _ = RelationshipService.get_blast_radius(asset_id)
            
            nodes = []
            edges = []
            seen_node_ids = set()
            
            # 1. Root Node
            nodes.append({
                'id': root['id'],
                'type': 'custom',
                'position': {'x': 350, 'y': 250},
                'data': {
                    'id': root['id'],
                    'label': root['name'],
                    'type': root['type'],
                    'status': root['status'],
                    'isRoot': True,
                    'role': 'Root Subject'
                }
            })
            seen_node_ids.add(root['id'])
            
            # 2. Upstream Dependencies (Assets that root depends on / connects to)
            upstream_y = 70
            upstream_x_start = 100
            for idx, rel in enumerate(direct_rels['incoming']):
                parent = rel.get('parent')
                if not parent:
                    continue
                if parent['id'] not in seen_node_ids:
                    nodes.append({
                        'id': parent['id'],
                        'type': 'custom',
                        'position': {'x': upstream_x_start + (idx * 250), 'y': upstream_y},
                        'data': {
                            'id': parent['id'],
                            'label': parent['name'],
                            'type': parent['type'],
                            'status': parent['status'],
                            'isRoot': False,
                            'role': 'Upstream Provider'
                        }
                    })
                    seen_node_ids.add(parent['id'])
                    
                edges.append({
                    'id': f"edge_{rel['id']}",
                    'source': parent['id'],
                    'target': root['id'],
                    'label': rel['relationship_type'],
                    'animated': True,
                    'style': {'stroke': '#38bdf8', 'strokeWidth': 2}
                })
                
            # 3. Downstream Direct & Cascading (Blast Radius)
            downstream_x_start = 80
            depth_spacing_y = 200
            
            for idx, item in enumerate(blast_data['impacted_assets']):
                curr_id = item['asset_id']
                depth = item.get('depth', 1)
                
                if curr_id not in seen_node_ids:
                    nodes.append({
                        'id': curr_id,
                        'type': 'custom',
                        'position': {
                            'x': downstream_x_start + ((idx % 4) * 260),
                            'y': 250 + (depth * depth_spacing_y)
                        },
                        'data': {
                            'id': curr_id,
                            'label': item['asset_name'],
                            'type': item['asset_type'],
                            'status': item['asset_status'],
                            'isRoot': False,
                            'impactLevel': item.get('impact_level', 'DIRECT_IMPACT'),
                            'depth': depth,
                            'role': 'Downstream Consumer'
                        }
                    })
                    seen_node_ids.add(curr_id)
                    
            # 4. Outgoing direct edges from root
            for rel in direct_rels['outgoing']:
                child = rel.get('child')
                if not child:
                    continue
                edges.append({
                    'id': f"edge_{rel['id']}",
                    'source': root['id'],
                    'target': child['id'],
                    'label': rel['relationship_type'],
                    'animated': True,
                    'style': {'stroke': '#f43f5e', 'strokeWidth': 2}
                })
                
            return {
                'nodes': nodes,
                'edges': edges,
                'blast_radius': blast_data
            }, None, 200

        else:
            # Global Infrastructure Topology
            all_assets_res = AssetRepository.get_all()
            all_rels_res = RelationshipRepository.get_all()
            
            assets = all_assets_res.data or []
            rels = all_rels_res.data or []
            
            nodes = []
            for idx, a in enumerate(assets):
                col = idx % 5
                row = idx // 5
                nodes.append({
                    'id': a['id'],
                    'type': 'custom',
                    'position': {'x': 60 + (col * 240), 'y': 60 + (row * 180)},
                    'data': {
                        'id': a['id'],
                        'label': a['name'],
                        'type': a['type'],
                        'status': a['status'],
                        'isRoot': False
                    }
                })
                
            edges = []
            for r in rels:
                edges.append({
                    'id': f"edge_{r['id']}",
                    'source': r['parent_asset_id'],
                    'target': r['child_asset_id'],
                    'label': r['relationship_type'],
                    'animated': True,
                    'style': {'stroke': '#a855f7', 'strokeWidth': 2}
                })
                
            return {'nodes': nodes, 'edges': edges}, None, 200
