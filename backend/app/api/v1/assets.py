"""Asset Routes Blueprint"""

from flask import Blueprint, request, jsonify
from ...core.security import get_user_profile, get_jwt_identity, role_required
from ...services.asset_service import AssetService

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
@role_required(['admin', 'operator'])
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
@role_required(['admin', 'operator'])
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
@role_required(['admin'])
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
