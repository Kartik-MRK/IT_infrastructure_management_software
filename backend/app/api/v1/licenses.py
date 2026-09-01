"""Software License Management & Compliance Routes Blueprint"""

from flask import Blueprint, request, jsonify
from ...core.security import get_user_profile, get_jwt_identity, role_required
from ...services.license_service import LicenseService

licenses_bp = Blueprint('licenses', __name__, url_prefix='/api')

@licenses_bp.route('/licenses', methods=['GET'])
def get_licenses():
    """List all software licenses with seat utilization metrics"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        software_asset_id = request.args.get('software_asset_id')
        department_id = request.args.get('department_id')
        
        licenses = LicenseService.get_all_licenses(
            software_asset_id=software_asset_id,
            department_id=department_id
        )
        return jsonify({'licenses': licenses, 'count': len(licenses)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@licenses_bp.route('/licenses', methods=['POST'])
@role_required(['admin', 'it_admin', 'infrastructure_engineer', 'asset_custodian'])
def create_license(current_user):
    """Create a new software license"""
    try:
        data = request.get_json() or {}
        license_obj, error, status_code = LicenseService.create_license(data, user_id=current_user['id'])
        if error:
            return jsonify({'error': error}), status_code
            
        return jsonify({
            'message': 'Software license created successfully',
            'license': license_obj
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@licenses_bp.route('/licenses/<license_id>', methods=['GET'])
def get_license(license_id):
    """Fetch single license with full allocation roster"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        license_obj = LicenseService.get_license_by_id(license_id)
        if not license_obj:
            return jsonify({'error': 'License not found'}), 404
            
        return jsonify({'license': license_obj}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@licenses_bp.route('/licenses/<license_id>', methods=['PUT'])
@role_required(['admin', 'it_admin', 'infrastructure_engineer', 'asset_custodian'])
def update_license(license_id, current_user):
    """Update software license details"""
    try:
        data = request.get_json() or {}
        license_obj, error, status_code = LicenseService.update_license(license_id, data)
        if error:
            return jsonify({'error': error}), status_code
            
        return jsonify({
            'message': 'License updated successfully',
            'license': license_obj
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@licenses_bp.route('/licenses/<license_id>', methods=['DELETE'])
@role_required(['admin', 'it_admin', 'asset_custodian'])
def delete_license(license_id, current_user):
    """Delete software license"""
    try:
        success, message, status_code = LicenseService.delete_license(license_id)
        return jsonify({'message': message}), status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@licenses_bp.route('/licenses/<license_id>/allocate', methods=['POST'])
@role_required(['admin', 'it_admin', 'infrastructure_engineer', 'asset_custodian'])
def allocate_seat(license_id, current_user):
    """Allocate a license seat to a workstation/server or user"""
    try:
        data = request.get_json() or {}
        allocation, error, status_code = LicenseService.allocate_seat(license_id, data)
        if error:
            return jsonify({'error': error}), status_code
            
        return jsonify({
            'message': 'License seat allocated successfully',
            'allocation': allocation
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@licenses_bp.route('/licenses/allocations/<allocation_id>', methods=['DELETE'])
@role_required(['admin', 'it_admin', 'infrastructure_engineer', 'asset_custodian'])
def reclaim_seat(allocation_id, current_user):
    """Revoke or reclaim an allocated license seat"""
    try:
        success, message, status_code = LicenseService.reclaim_seat(allocation_id)
        return jsonify({'message': message}), status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@licenses_bp.route('/licenses/compliance-summary', methods=['GET'])
def get_compliance_summary():
    """Retrieve high-level license compliance and seat utilization summary"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        dashboard_data = LicenseService.get_compliance_dashboard()
        return jsonify(dashboard_data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
