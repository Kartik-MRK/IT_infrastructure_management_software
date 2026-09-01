"""REST API Endpoints for Incident Post-Mortems & Root Cause Analysis (RCA)"""

from flask import Blueprint, request, jsonify
from ...core.security import token_required, get_jwt_identity
from ...services.postmortem_service import PostMortemService

postmortems_bp = Blueprint('postmortems', __name__, url_prefix='/api')

@postmortems_bp.route('/incidents/<incident_id>/postmortem/generate', methods=['POST'])
@token_required
def generate_postmortem_draft(incident_id, current_user=None):
    """Generate or refresh automated post-mortem draft for an incident"""
    user_id = current_user['id'] if current_user else get_jwt_identity()
    draft, error, status = PostMortemService.generate_draft(incident_id, user_id)
    if error:
        return jsonify({'error': error}), status
    return jsonify({'postmortem': draft, 'message': 'Post-mortem draft generated'}), status

@postmortems_bp.route('/incidents/<incident_id>/postmortem', methods=['GET'])
@token_required
def get_incident_postmortem(incident_id, current_user=None):
    """Fetch post-mortem document for an incident (auto-generates draft if missing)"""
    user_id = current_user['id'] if current_user else get_jwt_identity()
    doc, error, status = PostMortemService.get_postmortem(incident_id, auto_generate=True, author_id=user_id)
    if error:
        return jsonify({'error': error}), status
    return jsonify({'postmortem': doc}), status

@postmortems_bp.route('/incidents/<incident_id>/postmortem', methods=['PUT'])
@token_required
def update_incident_postmortem(incident_id, current_user=None):
    """Update post-mortem content, 5-Whys analysis, action items, or publication status"""
    data = request.get_json() or {}
    updated, error, status = PostMortemService.update_postmortem(incident_id, data)
    if error:
        return jsonify({'error': error}), status
    return jsonify({'postmortem': updated, 'message': 'Post-mortem updated successfully'}), status

@postmortems_bp.route('/incidents/<incident_id>/postmortem/export', methods=['GET'])
@token_required
def export_incident_postmortem(incident_id, current_user=None):
    """Export formatted Markdown string for the post-mortem report"""
    markdown_content, error, status = PostMortemService.export_markdown(incident_id)
    if error:
        return jsonify({'error': error}), status
    return jsonify({'markdown': markdown_content}), status

@postmortems_bp.route('/postmortems', methods=['GET'])
@token_required
def list_postmortems(current_user=None):
    """List all post-mortem reports with optional status query param"""
    status_filter = request.args.get('status')
    items, error, status = PostMortemService.list_postmortems(status_filter)
    if error:
        return jsonify({'error': error}), status
    return jsonify({'postmortems': items, 'count': len(items)}), status
