"""Alerts Routes Blueprint"""

from flask import Blueprint, jsonify
from ...core.security import role_required
from ...services.alert_service import AlertService

alerts_bp = Blueprint('alerts', __name__, url_prefix='/api')

@alerts_bp.route('/alerts', methods=['GET'])
@role_required(['admin', 'operator'])
def get_alerts(current_user):
    try:
        alerts = AlertService.get_system_alerts()
        return jsonify({
            'alerts': alerts,
            'count': len(alerts)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
