"""Live Activity Feed Routes Blueprint"""

from flask import Blueprint, jsonify
from ...core.security import get_jwt_identity
from ...services.alert_service import AlertService

activities_bp = Blueprint('activities', __name__, url_prefix='/api')

@activities_bp.route('/activities', methods=['GET'])
def get_activities():
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        activities = AlertService.get_live_activities(limit=8)
        return jsonify({'activities': activities}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
