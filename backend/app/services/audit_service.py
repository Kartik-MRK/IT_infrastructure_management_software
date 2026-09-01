"""Physical Audit Service for Audit Workflows & QR Verification"""

from ..repositories.audit_repository import AuditRepository
from ..repositories.asset_repository import AssetRepository
from ..schemas.audit_schema import validate_audit_payload

class AuditService:
    """Business logic for physical asset audits, QR verifications, and compliance monitoring"""

    @staticmethod
    def record_physical_audit(asset_id, auditor_id, data):
        """Validate and record a physical asset audit"""
        cleaned, error = validate_audit_payload(data)
        if error:
            return None, error, 400

        asset_res = AssetRepository.get_by_id(asset_id)
        if not asset_res.data:
            return None, f"Asset '{asset_id}' not found", 404

        current_asset = asset_res.data

        # If location was not specified as verified, check if observed differs from registered
        if cleaned.get('observed_location') and current_asset.get('location'):
            if cleaned['observed_location'].strip().lower() != current_asset['location'].strip().lower():
                cleaned['location_verified'] = False

        # If status was not specified as verified, check if observed differs from registered
        if cleaned.get('observed_status') and current_asset.get('status'):
            if cleaned['observed_status'].strip().lower() != current_asset['status'].strip().lower():
                cleaned['status_verified'] = False

        try:
            audit_result = AuditRepository.record_audit(asset_id, auditor_id, cleaned)
            return {
                'message': 'Physical audit recorded successfully',
                'audit': audit_result
            }, None, 201
        except Exception as e:
            return None, str(e), 500

    @staticmethod
    def get_asset_audit_history(asset_id):
        """Fetch audit log timeline for a single asset"""
        asset_res = AssetRepository.get_by_id(asset_id)
        if not asset_res.data:
            return None, f"Asset '{asset_id}' not found", 404

        audits_res = AuditRepository.get_asset_audits(asset_id)
        return {
            'asset_id': asset_id,
            'audits': audits_res.data or [],
            'count': len(audits_res.data or [])
        }, None, 200

    @staticmethod
    def get_audit_compliance_summary():
        """Retrieve organization-wide physical audit compliance metrics"""
        summary = AuditRepository.get_summary()
        if not summary:
            return {
                'total_assets': 0,
                'audited_last_90_days': 0,
                'audit_compliance_percent': 0.00,
                'verified_count': 0,
                'flagged_count': 0,
                'missing_count': 0,
                'pending_count': 0
            }, None, 200
        return summary, None, 200

    @staticmethod
    def get_recent_audits(limit=20):
        """Retrieve recent physical audit events across all assets"""
        res = AuditRepository.get_recent_audits(limit)
        return {'audits': res.data or [], 'count': len(res.data or [])}, None, 200
