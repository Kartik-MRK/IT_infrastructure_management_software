"""Financial Lifecycle, TCO & Depreciation Blueprint"""

from flask import Blueprint, jsonify, request
from ...core.security import get_jwt_identity, role_required
from ...services.financial_service import FinancialService

financials_bp = Blueprint('financials', __name__, url_prefix='/api')

@financials_bp.route('/assets/<asset_id>/financials', methods=['GET'])
def get_asset_financials(asset_id):
    """Retrieve financial lifecycle, depreciation schedule, and TCO for a single asset"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        data, error, status_code = FinancialService.get_asset_financial_breakdown(asset_id)
        if error:
            return jsonify({'error': error}), status_code
            
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@financials_bp.route('/financials/executive-summary', methods=['GET'])
def get_executive_summary():
    """Retrieve organization-wide financial summary, Net Book Value, and TCO breakdown"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        data, error, status_code = FinancialService.get_executive_financial_overview()
        if error:
            return jsonify({'error': error}), status_code
            
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@financials_bp.route('/financials/depreciation-forecast', methods=['GET'])
def get_depreciation_forecast():
    """Retrieve 5-year forward projected depreciation curve for budget planning"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        data, error, status_code = FinancialService.get_depreciation_forecast()
        if error:
            return jsonify({'error': error}), status_code
            
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
