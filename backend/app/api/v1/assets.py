"""Asset & CMDB Dependency Topology Routes Blueprint"""

from flask import Blueprint, request, jsonify
from ...core.security import get_user_profile, get_jwt_identity, role_required, permission_required
from ...services.asset_service import AssetService
from ...services.relationship_service import RelationshipService

assets_bp = Blueprint('assets', __name__, url_prefix='/api')

@assets_bp.route('/assets', methods=['GET'])
def get_assets():
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        profile = get_user_profile(user_id)
        if not profile:
            return jsonify({'error': 'User profile not found'}), 404
            
        assets = AssetService.get_all_assets()
        return jsonify({
            'assets': assets,
            'count': len(assets),
            'user_role': profile.get('role', 'viewer')
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@assets_bp.route('/assets', methods=['POST'])
@role_required(['admin', 'operator', 'infrastructure_engineer', 'asset_custodian'])
def create_asset(current_user):
    try:
        data = request.get_json()
        asset, error = AssetService.create_asset(data, current_user['id'])
        if error:
            status_code = 400 if "Missing required" in error or "Invalid" in error else 500
            return jsonify({'error': error}), status_code
            
        return jsonify({
            'message': 'Asset created successfully',
            'asset': asset
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@assets_bp.route('/assets/<asset_id>', methods=['GET'])
def get_asset(asset_id):
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        asset = AssetService.get_asset_by_id(asset_id)
        if asset:
            return jsonify({'asset': asset}), 200
        return jsonify({'error': 'Asset not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@assets_bp.route('/assets/<asset_id>', methods=['PUT'])
@role_required(['admin', 'operator', 'infrastructure_engineer', 'asset_custodian'])
def update_asset(asset_id, current_user):
    try:
        data = request.get_json()
        asset, error, status_code = AssetService.update_asset(asset_id, data, current_user)
        if error:
            return jsonify({'error': error, 'message': error}), status_code
        return jsonify({
            'message': 'Asset updated successfully',
            'asset': asset
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@assets_bp.route('/assets/<asset_id>', methods=['DELETE'])
@role_required(['admin', 'it_admin'])
def delete_asset(asset_id, current_user):
    try:
        success, message, status_code = AssetService.delete_asset(asset_id, current_user)
        if not success:
            return jsonify({'error': message}), status_code
        return jsonify({'message': message}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@assets_bp.route('/assets/summary', methods=['GET'])
def get_assets_summary():
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        summary = AssetService.get_summary()
        return jsonify({'summary': summary}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@assets_bp.route('/assets/<asset_id>/metrics', methods=['GET'])
def get_asset_metrics(asset_id):
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        metrics = AssetService.get_latest_metrics(asset_id)
        if metrics:
            return jsonify({'metrics': metrics}), 200
        return jsonify({'metrics': None, 'message': 'No metrics available for this asset'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# CMDB & DEPENDENCY TOPOLOGY ENDPOINTS
# ============================================================================

@assets_bp.route('/assets/<asset_id>/relationships', methods=['GET'])
def get_asset_relationships(asset_id):
    """Retrieve direct upstream and downstream dependencies for an asset"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        rels = RelationshipService.get_relationships_for_asset(asset_id)
        return jsonify(rels), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@assets_bp.route('/assets/<asset_id>/relationships', methods=['POST'])
@role_required(['admin', 'it_admin', 'operator', 'infrastructure_engineer'])
def create_asset_relationship(asset_id, current_user):
    """Add a dependency relationship from this asset to another asset"""
    try:
        data = request.get_json() or {}
        child_asset_id = data.get('child_asset_id')
        relationship_type = data.get('relationship_type')
        description = data.get('description')
        
        # Support either parent_asset_id in payload or default to URL param
        parent_asset_id = data.get('parent_asset_id') or asset_id
        
        rel, error, status_code = RelationshipService.create_relationship(
            parent_asset_id=parent_asset_id,
            child_asset_id=child_asset_id,
            relationship_type=relationship_type,
            description=description,
            user_id=current_user['id']
        )
        if error:
            return jsonify({'error': error}), status_code
            
        return jsonify({
            'message': 'Relationship created successfully',
            'relationship': rel
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@assets_bp.route('/assets/relationships/<relationship_id>', methods=['DELETE'])
@role_required(['admin', 'it_admin', 'operator', 'infrastructure_engineer'])
def delete_asset_relationship(relationship_id, current_user):
    """Delete a dependency edge"""
    try:
        success, message, status_code = RelationshipService.delete_relationship(relationship_id)
        return jsonify({'message': message}), status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@assets_bp.route('/assets/<asset_id>/blast-radius', methods=['GET'])
def get_asset_blast_radius(asset_id):
    """Calculate cascading downstream outage impact using PostgreSQL recursive CTE"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        max_depth = int(request.args.get('max_depth', 5))
        data, error, status_code = RelationshipService.get_blast_radius(asset_id, max_depth=max_depth)
        if error:
            return jsonify({'error': error}), status_code
            
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@assets_bp.route('/assets/<asset_id>/topology', methods=['GET'])
def get_asset_topology(asset_id):
    """Generate React Flow nodes and edges centered on an asset with blast radius"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        data, error, status_code = RelationshipService.get_topology(asset_id)
        if error:
            return jsonify({'error': error}), status_code
            
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@assets_bp.route('/assets/topology', methods=['GET'])
def get_global_topology():
    """Generate global infrastructure topology graph across all assets"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        data, error, status_code = RelationshipService.get_topology(asset_id=None)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
