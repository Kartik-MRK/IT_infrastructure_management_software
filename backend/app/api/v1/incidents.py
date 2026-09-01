"""Incident Routes Blueprint"""

from flask import Blueprint, request, jsonify
from ...core.security import get_user_profile, get_jwt_identity, role_required
from ...services.incident_service import IncidentService

incidents_bp = Blueprint('incidents', __name__, url_prefix='/api')

@incidents_bp.route('/incidents', methods=['GET'])
def get_incidents():
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        status = request.args.get('status')
        severity = request.args.get('severity')
        asset_id = request.args.get('asset_id')
        
        incidents = IncidentService.get_all(status, severity, asset_id)
        return jsonify({
            'incidents': incidents,
            'count': len(incidents)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@incidents_bp.route('/incidents/stats', methods=['GET'])
def get_incident_stats():
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        incidents = IncidentService.get_all()
        stats = {
            'total': len(incidents),
            'by_status': {},
            'by_severity': {},
            'by_category': {},
            'open_critical': 0
        }
        for inc in incidents:
            status = inc.get('status', 'open')
            severity = inc.get('severity', 'low')
            category = inc.get('category') or 'other'
            stats['by_status'][status] = stats['by_status'].get(status, 0) + 1
            stats['by_severity'][severity] = stats['by_severity'].get(severity, 0) + 1
            stats['by_category'][category] = stats['by_category'].get(category, 0) + 1
            if status == 'open' and severity == 'critical':
                stats['open_critical'] += 1
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@incidents_bp.route('/incidents', methods=['POST'])
def create_incident():
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        profile = get_user_profile(user_id)
        if not profile:
            return jsonify({'error': 'User profile not found'}), 404
            
        data = request.get_json()
        incident, error, status_code = IncidentService.create_incident(data, profile)
        if error:
            return jsonify({'error': error}), status_code
            
        return jsonify({
            'message': 'Incident reported successfully',
            'incident': incident
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@incidents_bp.route('/incidents/<incident_id>', methods=['GET'])
def get_incident(incident_id):
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        incident = IncidentService.get_by_id(incident_id)
        if incident:
            return jsonify({'incident': incident}), 200
        return jsonify({'error': 'Incident not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@incidents_bp.route('/incidents/<incident_id>', methods=['PUT'])
def update_incident(incident_id):
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        profile = get_user_profile(user_id)
        if not profile:
            return jsonify({'error': 'User profile not found'}), 404
            
        data = request.get_json()
        incident, error, status_code = IncidentService.update_incident(incident_id, data, profile)
        if error:
            return jsonify({'error': error, 'message': error}), status_code
            
        return jsonify({
            'message': 'Incident updated successfully',
            'incident': incident
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@incidents_bp.route('/incidents/<incident_id>/assign', methods=['PUT'])
@role_required(['admin', 'operator'])
def assign_incident(incident_id, current_user):
    try:
        data = request.get_json()
        assigned_to = data.get('assigned_to')
        if not assigned_to:
            return jsonify({'error': 'assigned_to field is required'}), 400
            
        incident, error, status_code = IncidentService.assign_incident(incident_id, assigned_to, current_user)
        if error:
            return jsonify({'error': error}), status_code
            
        return jsonify({
            'message': 'Incident assigned successfully',
            'incident': incident
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@incidents_bp.route('/incidents/<incident_id>/status', methods=['PUT'])
@role_required(['admin', 'operator'])
def update_incident_status(incident_id, current_user):
    try:
        data = request.get_json()
        new_status = data.get('status')
        resolution_notes = data.get('resolution_notes')
        
        if not new_status:
            return jsonify({'error': 'status field is required'}), 400
            
        incident, error, status_code = IncidentService.update_status(incident_id, new_status, resolution_notes, current_user)
        if error:
            return jsonify({'error': error}), status_code
            
        return jsonify({
            'message': f'Incident status updated to {new_status}',
            'incident': incident
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@incidents_bp.route('/incidents/<incident_id>/escalate', methods=['POST'])
@role_required(['admin', 'operator'])
def escalate_incident(incident_id, current_user):
    try:
        data = request.get_json() or {}
        priority_boost = data.get('priority_boost', 2)
        
        incident, error, status_code = IncidentService.escalate_incident(incident_id, priority_boost, current_user)
        if error:
            return jsonify({'error': error}), status_code
            
        return jsonify({
            'message': 'Incident escalated successfully',
            'incident': incident
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@incidents_bp.route('/incidents/<incident_id>', methods=['DELETE'])
@role_required(['admin'])
def delete_incident(incident_id, current_user):
    try:
        success, message, status_code = IncidentService.delete_incident(incident_id, current_user)
        if not success:
            return jsonify({'error': message}), status_code
        return jsonify({'message': message}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
