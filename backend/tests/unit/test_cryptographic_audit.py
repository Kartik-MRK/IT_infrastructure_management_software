"""Unit Tests for Cryptographic Audit Logging & Chain Integrity Verification"""

import pytest
from unittest.mock import Mock, patch
from app import app
from app.schemas.crypto_audit_schema import validate_audit_log_payload, validate_certificate_request
from app.services.crypto_audit_service import CryptoAuditService

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

class TestCryptoAuditSchema:
    """Test payload validation for cryptographic audit entries"""

    def test_valid_audit_payload(self):
        data = {
            'action': 'ASSET_DECOMMISSIONED',
            'entity_type': 'ASSET',
            'entity_id': 'srv-core-01',
            'payload': {'reason': 'End of lifecycle'}
        }
        cleaned, error = validate_audit_log_payload(data)
        assert error is None
        assert cleaned['action'] == 'ASSET_DECOMMISSIONED'
        assert cleaned['entity_id'] == 'srv-core-01'

    def test_missing_action_rejection(self):
        cleaned, error = validate_audit_log_payload({'entity_type': 'ASSET', 'entity_id': '1'})
        assert "action field is required" in error

    def test_missing_entity_id_rejection(self):
        cleaned, error = validate_audit_log_payload({'action': 'LOGIN', 'entity_type': 'USER'})
        assert "entity_id field is required" in error

    def test_certificate_request_validation(self):
        cleaned, error = validate_certificate_request({'auditor_name': 'KPMG Auditor'})
        assert error is None
        assert cleaned['auditor_name'] == 'KPMG Auditor'

class TestCryptoAuditService:
    """Test Cryptographic Audit service logic and verification sweeps"""

    @patch('app.services.crypto_audit_service.CryptoAuditRepository')
    def test_append_log_success(self, mock_repo):
        mock_repo.append_log.return_value = {
            'sequence_number': 4,
            'action': 'LICENSE_ALLOCATED',
            'entry_hash': 'abcdef1234567890'
        }
        rec, error, status = CryptoAuditService.append_log({
            'action': 'LICENSE_ALLOCATED',
            'entity_type': 'LICENSE',
            'entity_id': 'lic-01',
            'payload': {'user': 'Alice'}
        })
        assert status == 201
        assert rec['sequence_number'] == 4

    @patch('app.services.crypto_audit_service.CryptoAuditRepository')
    def test_verify_chain_integrity_success(self, mock_repo):
        mock_repo.verify_chain_integrity.return_value = {
            'is_valid': True,
            'total_records': 10,
            'tampered_records_count': 0,
            'merkle_head_hash': 'headhash123'
        }
        res, error, status = CryptoAuditService.verify_chain_integrity()
        assert status == 200
        assert res['is_valid'] is True
        assert res['tampered_records_count'] == 0

    @patch('app.services.crypto_audit_service.CryptoAuditRepository')
    def test_generate_compliance_certificate(self, mock_repo):
        mock_repo.generate_compliance_certificate.return_value = {
            'certificate_id': 'cert-1',
            'compliance_standard': 'SOC 2 Type II',
            'chain_status': 'VERIFIED_TAMPER_PROOF',
            'is_tamper_proof': True
        }
        cert, error, status = CryptoAuditService.generate_compliance_certificate({'auditor_name': 'Auditor'})
        assert status == 200
        assert cert['is_tamper_proof'] is True
        assert cert['chain_status'] == 'VERIFIED_TAMPER_PROOF'

class TestCryptoAuditEndpoints:
    """Test REST API endpoints for Cryptographic Audit Logs"""

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.crypto_audit_service.CryptoAuditRepository')
    def test_verify_audit_chain_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'user-1'
        mock_profile.return_value = {'id': 'user-1', 'role': 'compliance_officer'}
        mock_repo.verify_chain_integrity.return_value = {
            'is_valid': True,
            'total_records': 5
        }

        res = client.post('/api/audit-ledger/verify',
                          headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['integrity_report']['is_valid'] is True

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.crypto_audit_service.CryptoAuditRepository')
    def test_get_compliance_certificate_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'user-1'
        mock_profile.return_value = {'id': 'user-1', 'role': 'admin'}
        mock_repo.generate_compliance_certificate.return_value = {
            'certificate_id': 'cert-soc2',
            'compliance_standard': 'SOC 2 Type II'
        }

        res = client.get('/api/audit-ledger/compliance-certificate?auditor_name=PwC',
                         headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['certificate']['certificate_id'] == 'cert-soc2'

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.crypto_audit_service.CryptoAuditRepository')
    def test_list_audit_logs_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'user-1'
        mock_profile.return_value = {'id': 'user-1', 'role': 'viewer'}
        mock_repo.list_logs.return_value = [
            {'sequence_number': 1, 'action': 'GENESIS', 'entry_hash': 'hash1'}
        ]

        res = client.get('/api/audit-ledger',
                         headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert len(data['audit_logs']) == 1
