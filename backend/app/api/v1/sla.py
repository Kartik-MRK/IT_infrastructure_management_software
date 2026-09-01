"""REST API Endpoints for Service Level Agreement (SLA) Engine"""

from flask import Blueprint, request, jsonify
from ...core.security import token_required, get_jwt_identity, get_user_profile
from ...services.sla_service import SLAService

sla_bp = Blueprint('sla', __name__, url_prefix='/api')

@sla_bp.route('/sla/policies', methods=['GET'])
@token_required
def list_sla_policies(current_user=None):
    """List all SLA policies configured in the system"""
    policies, error, status = SLAService.get_all_policies()
    if error:
        return jsonify({'error': error}), status
    return jsonify({'policies': policies}), 200

@sla_bp.route('/sla/policies/<policy_id>', methods=['PUT'])
@token_required
def update_sla_policy(policy_id, current_user=None):
    """Update SLA response/resolution targets and business hours for a policy"""
    user_id = current_user['id'] if current_user else get_jwt_identity()
    user_profile = current_user or get_user_profile(user_id)

    data = request.get_json() or {}
    policy, error, status = SLAService.update_policy(policy_id, data, user_profile)
    if error:
        return jsonify({'error': error}), status
    return jsonify({'policy': policy, 'message': 'SLA Policy updated successfully'}), 200

@sla_bp.route('/incidents/<incident_id>/acknowledge', methods=['POST'])
@token_required
def acknowledge_incident_sla(incident_id, current_user=None):
    """Acknowledge incident to capture first response timestamp and verify response SLA"""
    user_id = current_user['id'] if current_user else get_jwt_identity()
    incident, error, status = SLAService.acknowledge_incident(incident_id, user_id)
    if error and status != 200:
        return jsonify({'error': error}), status
    return jsonify({'incident': incident, 'message': error or 'Incident acknowledged successfully'}), status

@sla_bp.route('/sla/summary', methods=['GET'])
@token_required
def get_sla_summary(current_user=None):
    """Get organization-wide SLA compliance metrics, MTTR, and MTTD"""
    summary, error, status = SLAService.get_sla_compliance_summary()
    if error:
        return jsonify({'error': error}), status
    return jsonify(summary), 200
