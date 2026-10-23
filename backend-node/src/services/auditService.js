/**
 * Physical Audit Service for Audit Workflows & QR Verification
 */

import { AuditRepository } from '../repositories/auditRepository.js';
import { AssetRepository } from '../repositories/assetRepository.js';
import { validateAuditPayload } from '../schemas/auditSchema.js';

export class AuditService {
  /**
   * Validate and record a physical asset audit
   */
  static async recordPhysicalAudit(assetId, auditorId, data) {
    const { data: cleaned, error } = validateAuditPayload(data);
    if (error) {
      return { result: null, error, statusCode: 400 };
    }

    const assetRes = await AssetRepository.getById(assetId);
    const currentAsset = assetRes?.data || (assetRes && !assetRes.error ? assetRes : null);
    if (!currentAsset) {
      return { result: null, error: `Asset '${assetId}' not found`, statusCode: 404 };
    }

    // Check location discrepancy
    if (cleaned.observed_location && currentAsset.location) {
      if (cleaned.observed_location.trim().toLowerCase() !== currentAsset.location.trim().toLowerCase()) {
        cleaned.location_verified = false;
      }
    }

    // Check status discrepancy
    if (cleaned.observed_status && currentAsset.status) {
      if (cleaned.observed_status.trim().toLowerCase() !== currentAsset.status.trim().toLowerCase()) {
        cleaned.status_verified = false;
      }
    }

    try {
      const auditResult = await AuditRepository.recordAudit(assetId, auditorId, cleaned);
      return {
        result: {
          message: 'Physical audit recorded successfully',
          audit: auditResult,
        },
        error: null,
        statusCode: 201,
      };
    } catch (err) {
      return { result: null, error: err.message, statusCode: 500 };
    }
  }

  /**
   * Fetch audit log timeline for a single asset
   */
  static async getAssetAuditHistory(assetId) {
    const assetRes = await AssetRepository.getById(assetId);
    const currentAsset = assetRes?.data || (assetRes && !assetRes.error ? assetRes : null);
    if (!currentAsset) {
      return { data: null, error: `Asset '${assetId}' not found`, statusCode: 404 };
    }

    const audits = await AuditRepository.getAssetAudits(assetId);
    return {
      data: {
        asset_id: assetId,
        audits,
        count: audits.length,
      },
      error: null,
      statusCode: 200,
    };
  }

  /**
   * Retrieve organization-wide physical audit compliance metrics
   */
  static async getAuditComplianceSummary() {
    const summary = await AuditRepository.getSummary();
    if (!summary) {
      return {
        data: {
          total_assets: 0,
          audited_last_90_days: 0,
          audit_compliance_percent: 0.0,
          verified_count: 0,
          flagged_count: 0,
          missing_count: 0,
          pending_count: 0,
        },
        error: null,
        statusCode: 200,
      };
    }
    return { data: summary, error: null, statusCode: 200 };
  }

  /**
   * Retrieve recent physical audit events across all assets
   */
  static async getRecentAudits(limit = 20) {
    const audits = await AuditRepository.getRecentAudits(limit);
    return {
      data: {
        audits,
        count: audits.length,
      },
      error: null,
      statusCode: 200,
    };
  }
}
