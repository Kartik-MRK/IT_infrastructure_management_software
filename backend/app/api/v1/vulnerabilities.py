"""REST API Endpoints for CVE Vulnerability Scans, Posture & Incident Remediation"""

from flask import Blueprint, request, jsonify
from ...core.security import token_required, get_jwt_identity
from ...services.cve_service import CVEService

vulnerabilities_bp = Blueprint('vulnerabilities', __name__, url_prefix='/api')

@vulnerabilities_bp.route('/assets/<asset_id>/scan-vulnerabilities', methods=['POST'])
@token_required
def scan_asset_vulnerabilities(asset_id, current_user=None):
    """Execute vulnerability scan on target asset against CVE database cache"""
    result, error, status = CVEService.scan_asset(asset_id)
    if error:
        return jsonify({'error': error}), status
    return jsonify({'scan_result': result, 'message': 'Vulnerability scan completed'}), status

@vulnerabilities_bp.route('/assets/<asset_id>/vulnerabilities', methods=['GET'])
@token_required
def get_asset_vulnerabilities(asset_id, current_user=None):
    """Retrieve all detected CVE vulnerabilities on an asset"""
    vulns, error, status = CVEService.get_asset_vulnerabilities(asset_id)
    if error:
        return jsonify({'error': error}), status
    return jsonify({'vulnerabilities': vulns, 'count': len(vulns)}), status

@vulnerabilities_bp.route('/vulnerabilities/<vuln_id>/create-incident', methods=['POST'])
@token_required
def create_cve_remediation_incident(vuln_id, current_user=None):
    """1-Click creation of an automated remediation incident from a CVE finding"""
    user_id = current_user['id'] if current_user else get_jwt_identity()
    result, error, status = CVEService.create_remediation_incident(vuln_id, user_id)
    if error:
        return jsonify({'error': error}), status
    return jsonify(result), status

@vulnerabilities_bp.route('/vulnerabilities/<vuln_id>/status', methods=['PUT'])
@token_required
def update_vulnerability_status(vuln_id, current_user=None):
    """Update lifecycle status of a vulnerability finding"""
    data = request.get_json() or {}
    updated, error, status = CVEService.update_vuln_status(vuln_id, data)
    if error:
        return jsonify({'error': error}), status
    return jsonify({'vulnerability': updated, 'message': 'Status updated successfully'}), status

@vulnerabilities_bp.route('/vulnerabilities/summary', methods=['GET'])
@token_required
def get_vulnerability_summary(current_user=None):
    """Retrieve global infrastructure security vulnerability posture scorecard"""
    summary, error, status = CVEService.get_system_summary()
    if error:
        return jsonify({'error': error}), status
    return jsonify({'summary': summary}), status

@vulnerabilities_bp.route('/vulnerabilities', methods=['GET'])
@token_required
def list_all_vulnerabilities(current_user=None):
    """List all vulnerability findings across the infrastructure with optional severity filter"""
    severity = request.args.get('severity')
    status_filter = request.args.get('status')
    items, error, status = CVEService.list_all_vulnerabilities(severity, status_filter)
    if error:
        return jsonify({'error': error}), status
    return jsonify({'vulnerabilities': items, 'count': len(items)}), status
