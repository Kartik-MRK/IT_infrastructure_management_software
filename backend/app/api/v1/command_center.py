"""REST API Endpoints for Executive Analytics & SRE Command Center"""

from flask import Blueprint, jsonify
from ...core.security import token_required
from ...services.command_center_service import CommandCenterService

command_center_bp = Blueprint('command_center', __name__, url_prefix='/api')

@command_center_bp.route('/command-center/metrics', methods=['GET'])
@token_required
def get_command_center_metrics(current_user=None):
    """Retrieve unified executive and SRE command center dataset"""
    data, error, status = CommandCenterService.get_metrics()
    if error:
        return jsonify({'error': error}), status
    return jsonify({'command_center': data}), status
