"""Service Layer for Cryptographic Audit Logging, Chain Verification & Compliance Export"""

from ..schemas.crypto_audit_schema import validate_audit_log_payload, validate_certificate_request
from ..repositories.crypto_audit_repository import CryptoAuditRepository

class CryptoAuditService:
    """Encapsulates business logic for tamper-evident logging and SOC 2 compliance verification"""

    @staticmethod
    def append_log(payload: dict, actor_id: str = None, actor_email: str = None, client_ip: str = '127.0.0.1', user_agent: str = 'ITIMS-Core'):
        """Validate and append an immutable hash-chained audit record"""
        cleaned, error = validate_audit_log_payload(payload)
        if error:
            return None, error, 400

        email = actor_email or cleaned.get('actor_email') or 'system@itims.local'
        ip = client_ip or cleaned.get('client_ip') or '127.0.0.1'
        ua = user_agent or cleaned.get('user_agent') or 'ITIMS-Core'

        try:
            record = CryptoAuditRepository.append_log(
                actor_id=actor_id,
                actor_email=email,
                action=cleaned['action'],
                entity_type=cleaned['entity_type'],
                entity_id=cleaned['entity_id'],
                payload=cleaned['payload'],
                client_ip=ip,
                user_agent=ua
            )
            return record, None, 201
        except Exception as err:
            return None, f"Failed to record cryptographic audit log: {str(err)}", 500

    @staticmethod
    def verify_chain_integrity():
        """Execute automated cryptographic sweep verifying the complete audit chain"""
        try:
            verification = CryptoAuditRepository.verify_chain_integrity()
            return verification, None, 200
        except Exception as err:
            return None, f"Failed to verify cryptographic chain integrity: {str(err)}", 500

    @staticmethod
    def generate_compliance_certificate(request_payload: dict = None):
        """Generate official SOC 2 Type II signed compliance certificate"""
        cleaned, error = validate_certificate_request(request_payload or {})
        if error:
            return None, error, 400

        try:
            certificate = CryptoAuditRepository.generate_compliance_certificate(cleaned['auditor_name'])
            return certificate, None, 200
        except Exception as err:
            return None, f"Failed to generate compliance certificate: {str(err)}", 500

    @staticmethod
    def list_logs(limit: int = 50, offset: int = 0, action: str = None):
        """List audit log records"""
        try:
            logs = CryptoAuditRepository.list_logs(limit=limit, offset=offset, action=action)
            return logs, None, 200
        except Exception as err:
            return None, f"Failed to fetch cryptographic audit logs: {str(err)}", 500
