"""Physical Asset Auditing & QR Scanning Blueprint"""

from flask import Blueprint, jsonify, request
from ...core.security import get_jwt_identity, role_required
from ...services.audit_service import AuditService

audits_bp = Blueprint('audits', __name__, url_prefix='/api')

@audits_bp.route('/assets/<asset_id>/audits', methods=['POST'])
@role_required(['admin', 'it_admin', 'infrastructure_engineer', 'asset_custodian', 'technician'])
def record_audit(asset_id, current_user):
    """Record a physical asset audit verification"""
    try:
        data = request.get_json() or {}
        result, error, status_code = AuditService.record_physical_audit(
            asset_id=asset_id,
            auditor_id=current_user['id'],
            data=data
        )
        if error:
            return jsonify({'error': error}), status_code

        return jsonify(result), status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@audits_bp.route('/assets/<asset_id>/audits', methods=['GET'])
def get_asset_audits(asset_id):
    """Retrieve historical physical audit timeline for an asset"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401

        data, error, status_code = AuditService.get_asset_audit_history(asset_id)
        if error:
            return jsonify({'error': error}), status_code

        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@audits_bp.route('/audits/summary', methods=['GET'])
def get_audit_summary():
    """Retrieve organization-wide physical audit compliance metrics"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401

        data, error, status_code = AuditService.get_audit_compliance_summary()
        if error:
            return jsonify({'error': error}), status_code

        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@audits_bp.route('/audits/recent', methods=['GET'])
def get_recent_audits():
    """Retrieve recent physical audits stream"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401

        limit = request.args.get('limit', 20, type=int)
        data, error, status_code = AuditService.get_recent_audits(limit=limit)
        if error:
            return jsonify({'error': error}), status_code

        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
