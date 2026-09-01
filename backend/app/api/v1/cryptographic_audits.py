"""REST API Endpoints for Cryptographic Audit Logging & Chain Integrity Sweeps"""

from flask import Blueprint, request, jsonify
from ...core.security import token_required, get_jwt_identity
from ...services.crypto_audit_service import CryptoAuditService

crypto_audits_bp = Blueprint('crypto_audits', __name__, url_prefix='/api')

@crypto_audits_bp.route('/audit-ledger/verify', methods=['POST'])
@token_required
def verify_audit_chain_integrity(current_user=None):
    """Execute complete cryptographic hash chain verification sweep across all audit blocks"""
    result, error, status = CryptoAuditService.verify_chain_integrity()
    if error:
        return jsonify({'error': error}), status
    return jsonify({'integrity_report': result, 'message': 'Cryptographic integrity sweep completed'}), status

@crypto_audits_bp.route('/audit-ledger/compliance-certificate', methods=['GET', 'POST'])
@token_required
def generate_compliance_certificate(current_user=None):
    """Generate signed SOC 2 Type II / ISO 27001 Cryptographic Audit Certificate"""
    auditor_name = request.args.get('auditor_name') or (request.get_json() or {}).get('auditor_name')
    if not auditor_name and current_user:
        auditor_name = current_user.get('full_name') or current_user.get('email')
    
    cert, error, status = CryptoAuditService.generate_compliance_certificate({'auditor_name': auditor_name})
    if error:
        return jsonify({'error': error}), status
    return jsonify({'certificate': cert}), status

@crypto_audits_bp.route('/audit-ledger', methods=['GET'])
@token_required
def list_cryptographic_audit_logs(current_user=None):
    """List immutable hash-chained audit log records with pagination and filters"""
    limit = int(request.args.get('limit', 50))
    offset = int(request.args.get('offset', 0))
    action_filter = request.args.get('action')

    logs, error, status = CryptoAuditService.list_logs(limit=limit, offset=offset, action=action_filter)
    if error:
        return jsonify({'error': error}), status
    return jsonify({'audit_logs': logs, 'count': len(logs)}), status

@crypto_audits_bp.route('/audit-ledger/log', methods=['POST'])
@token_required
def append_cryptographic_audit_log(current_user=None):
    """Append a custom cryptographic audit log entry"""
    data = request.get_json() or {}
    user_id = current_user['id'] if current_user else get_jwt_identity()
    user_email = current_user.get('email') if current_user else 'system@itims.local'
    client_ip = request.remote_addr or '127.0.0.1'
    user_agent = request.headers.get('User-Agent', 'ITIMS-Web-Client')

    record, error, status = CryptoAuditService.append_log(
        payload=data,
        actor_id=user_id,
        actor_email=user_email,
        client_ip=client_ip,
        user_agent=user_agent
    )
    if error:
        return jsonify({'error': error}), status
    return jsonify({'audit_entry': record, 'message': 'Audit log appended to cryptographic chain'}), status
