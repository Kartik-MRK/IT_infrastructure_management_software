"""REST API Endpoints for Telemetry Streaming, Anomaly Detection & Chaos Simulation"""

from flask import Blueprint, request, jsonify
from ...core.security import token_required
from ...services.telemetry_service import TelemetryService

telemetry_bp = Blueprint('telemetry', __name__, url_prefix='/api')

@telemetry_bp.route('/assets/<asset_id>/telemetry', methods=['POST'])
@token_required
def ingest_asset_telemetry(asset_id, current_user=None):
    """Ingest a real-time metric sample for an asset and evaluate outlier Z-score anomalies"""
    data = request.get_json() or {}
    auto_incident = request.args.get('auto_incident', 'true').lower() == 'true'
    result, error, status = TelemetryService.ingest_metric(asset_id, data, auto_incident)
    if error:
        return jsonify({'error': error}), status
    return jsonify({'result': result, 'message': 'Telemetry ingested and evaluated'}), status

@telemetry_bp.route('/assets/<asset_id>/telemetry/history', methods=['GET'])
@token_required
def get_asset_telemetry_history(asset_id, current_user=None):
    """Fetch recent historical time-series samples for sparkline charts and trend analysis"""
    limit = request.args.get('limit', 30, type=int)
    history, error, status = TelemetryService.get_asset_history(asset_id, limit)
    if error:
        return jsonify({'error': error}), status
    return jsonify({'history': history, 'count': len(history)}), status

@telemetry_bp.route('/telemetry/simulate', methods=['POST'])
@token_required
def simulate_telemetry_stream(current_user=None):
    """Trigger a synthetic telemetry simulation step across all assets with optional chaos scenario"""
    data = request.get_json() or {}
    result, error, status = TelemetryService.simulate_telemetry_tick(data)
    if error:
        return jsonify({'error': error}), status
    return jsonify(result), status

@telemetry_bp.route('/telemetry/anomalies/summary', methods=['GET'])
@token_required
def get_anomaly_summary(current_user=None):
    """Get system-wide anomaly statistics, affected assets, and active outlier alerts"""
    summary, error, status = TelemetryService.get_system_summary()
    if error:
        return jsonify({'error': error}), status
    return jsonify(summary), status
