/**
 * Service Layer for Cryptographic Audit Logging, Chain Verification & Compliance Export
 */

import { validateAuditLogPayload, validateCertificateRequest } from '../schemas/cryptoAuditSchema.js';
import { CryptoAuditRepository } from '../repositories/cryptoAuditRepository.js';

export class CryptoAuditService {
  /**
   * Validate and append an immutable hash-chained audit record
   */
  static async appendLog({
    payload,
    actorId = null,
    actorEmail = null,
    clientIp = '127.0.0.1',
    userAgent = 'ITIMS-Core',
  }) {
    const { data: cleaned, error } = validateAuditLogPayload(payload);
    if (error) {
      return { record: null, error, statusCode: 400 };
    }

    const email = actorEmail || cleaned.actor_email || 'system@itims.local';
    const ip = clientIp || cleaned.client_ip || '127.0.0.1';
    const ua = userAgent || cleaned.user_agent || 'ITIMS-Core';

    try {
      const record = await CryptoAuditRepository.appendLog({
        actorId,
        actorEmail: email,
        action: cleaned.action,
        entityType: cleaned.entity_type,
        entityId: cleaned.entity_id,
        payload: cleaned.payload,
        clientIp: ip,
        userAgent: ua,
      });
      return { record, error: null, statusCode: 201 };
    } catch (err) {
      return { record: null, error: `Failed to record cryptographic audit log: ${err.message}`, statusCode: 500 };
    }
  }

  /**
   * Execute automated cryptographic sweep verifying the complete audit chain
   */
  static async verifyChainIntegrity() {
    try {
      const verification = await CryptoAuditRepository.verifyChainIntegrity();
      return { result: verification, error: null, statusCode: 200 };
    } catch (err) {
      return { result: null, error: `Failed to verify cryptographic chain integrity: ${err.message}`, statusCode: 500 };
    }
  }

  /**
   * Generate official SOC 2 Type II signed compliance certificate
   */
  static async generateComplianceCertificate(requestPayload = null) {
    const { data: cleaned, error } = validateCertificateRequest(requestPayload || {});
    if (error) {
      return { certificate: null, error, statusCode: 400 };
    }

    try {
      const certificate = await CryptoAuditRepository.generateComplianceCertificate(
        cleaned.auditor_name
      );
      return { certificate, error: null, statusCode: 200 };
    } catch (err) {
      return { certificate: null, error: `Failed to generate compliance certificate: ${err.message}`, statusCode: 500 };
    }
  }

  /**
   * List audit log records
   */
  static async listLogs({ limit = 50, offset = 0, action = null } = {}) {
    try {
      const logs = await CryptoAuditRepository.listLogs({ limit, offset, action });
      return { logs, error: null, statusCode: 200 };
    } catch (err) {
      return { logs: [], error: `Failed to fetch cryptographic audit logs: ${err.message}`, statusCode: 500 };
    }
  }
}
