/**
 * Software License Service for Business Logic & Compliance Calculations
 */

import { LicenseRepository } from '../repositories/licenseRepository.js';
import { AssetRepository } from '../repositories/assetRepository.js';
import { validateLicenseData, validateAllocationData } from '../schemas/licenseSchema.js';

export class LicenseService {
  /**
   * Calculate real-time seat utilization and compliance status
   */
  static computeLicenseMetrics(licenseObj) {
    const total = licenseObj.total_seats || 0;
    const allocations = licenseObj.allocations || [];
    const allocatedCount = allocations.length;
    const availableCount = Math.max(0, total - allocatedCount);

    const utilization = total === 0 ? 100.0 : Math.round((allocatedCount / total) * 10000) / 100;

    const expDateStr = licenseObj.expiration_date;
    let daysUntilExpiry = null;
    let isExpired = false;

    if (expDateStr) {
      try {
        const expDate = new Date(String(expDateStr).slice(0, 10));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expDate.setHours(0, 0, 0, 0);
        const diffDays = Math.round((expDate - today) / (1000 * 60 * 60 * 24));
        daysUntilExpiry = diffDays;
        if (diffDays < 0) {
          isExpired = true;
        }
      } catch {
        // ignore date parse errors
      }
    }

    let compliance = 'COMPLIANT';
    if (isExpired) {
      compliance = 'EXPIRED';
    } else if (total > 0 && allocatedCount > total) {
      compliance = 'OVER_ALLOCATED';
    } else if (total > 0 && allocatedCount / total >= 0.9) {
      compliance = 'WARNING_90_PERCENT';
    }

    return {
      allocated_seats: allocatedCount,
      available_seats: availableCount,
      utilization_percent: utilization,
      days_until_expiration: daysUntilExpiry,
      compliance_status: compliance,
    };
  }

  /**
   * Fetch all software licenses with computed compliance and seat metrics
   */
  static async getAllLicenses({ softwareAssetId = null, departmentId = null } = {}) {
    const licenses = await LicenseRepository.getAll({ softwareAssetId, departmentId });
    return licenses.map((lic) => {
      const metrics = LicenseService.computeLicenseMetrics(lic);
      return { ...lic, ...metrics };
    });
  }

  /**
   * Fetch a single license with full allocation details
   */
  static async getLicenseById(licenseId) {
    const lic = await LicenseRepository.getById(licenseId);
    if (!lic) return null;

    const metrics = LicenseService.computeLicenseMetrics(lic);
    return { ...lic, ...metrics };
  }

  /**
   * Validate and create a new software license
   */
  static async createLicense(data, userId = null) {
    const { data: cleaned, error } = validateLicenseData(data, false);
    if (error) {
      return { license: null, error, statusCode: 400 };
    }

    // Verify software asset exists
    const assetRes = await AssetRepository.getById(cleaned.software_asset_id);
    const asset = assetRes?.data || (assetRes && !assetRes.error ? assetRes : null);
    if (!asset) {
      return { license: null, error: `Software asset '${cleaned.software_asset_id}' not found`, statusCode: 404 };
    }

    if (asset.type !== 'software') {
      return {
        license: null,
        error: `Asset '${asset.name}' is of type '${asset.type}'. Licenses can only be attached to 'software' assets.`,
        statusCode: 400,
      };
    }

    cleaned.created_by = userId;

    try {
      const created = await LicenseRepository.create(cleaned);
      if (!created) {
        return { license: null, error: 'Failed to create license', statusCode: 500 };
      }
      return { license: created, error: null, statusCode: 201 };
    } catch (err) {
      return { license: null, error: err.message, statusCode: 500 };
    }
  }

  /**
   * Update an existing license
   */
  static async updateLicense(licenseId, data) {
    const { data: cleaned, error } = validateLicenseData(data, true);
    if (error) {
      return { license: null, error, statusCode: 400 };
    }

    cleaned.updated_at = new Date().toISOString();

    try {
      const updated = await LicenseRepository.update(licenseId, cleaned);
      if (!updated) {
        return { license: null, error: 'License not found', statusCode: 404 };
      }
      return { license: updated, error: null, statusCode: 200 };
    } catch (err) {
      return { license: null, error: err.message, statusCode: 500 };
    }
  }

  /**
   * Delete a software license
   */
  static async deleteLicense(licenseId) {
    await LicenseRepository.delete(licenseId);
    return { success: true, message: 'License deleted successfully', statusCode: 200 };
  }

  /**
   * Allocate a license seat to a hardware device or user
   */
  static async allocateSeat(licenseId, data) {
    const { data: cleaned, error } = validateAllocationData(data);
    if (error) {
      return { allocation: null, error, statusCode: 400 };
    }

    const lic = await LicenseRepository.getById(licenseId);
    if (!lic) {
      return { allocation: null, error: 'License not found', statusCode: 404 };
    }

    // Verify hardware asset if provided
    if (cleaned.allocated_to_asset_id) {
      const assetRes = await AssetRepository.getById(cleaned.allocated_to_asset_id);
      const asset = assetRes?.data || (assetRes && !assetRes.error ? assetRes : null);
      if (!asset) {
        return { allocation: null, error: `Hardware asset '${cleaned.allocated_to_asset_id}' not found`, statusCode: 404 };
      }
    }

    cleaned.license_id = licenseId;

    try {
      const created = await LicenseRepository.createAllocation(cleaned);
      if (!created) {
        return { allocation: null, error: 'Failed to allocate seat', statusCode: 500 };
      }
      return { allocation: created, error: null, statusCode: 201 };
    } catch (err) {
      const errMsg = err.message || '';
      if (errMsg.includes('uq_license_asset_alloc') || errMsg.includes('duplicate key')) {
        return {
          allocation: null,
          error: 'This hardware asset already has a seat allocated for this license',
          statusCode: 409,
        };
      }
      return { allocation: null, error: errMsg, statusCode: 500 };
    }
  }

  /**
   * Reclaim/revoke an allocated license seat
   */
  static async reclaimSeat(allocationId) {
    await LicenseRepository.deleteAllocation(allocationId);
    return { success: true, message: 'License seat reclaimed successfully', statusCode: 200 };
  }

  /**
   * Aggregated compliance metrics across all organization software licenses
   */
  static async getComplianceDashboard() {
    const summaryRecords = await LicenseRepository.getComplianceSummary();

    const totalLicenses = summaryRecords.length;
    const totalSeats = summaryRecords.reduce((acc, r) => acc + (r.total_seats || 0), 0);
    const totalAllocated = summaryRecords.reduce((acc, r) => acc + (r.allocated_seats || 0), 0);

    const compliantCount = summaryRecords.filter((r) => r.compliance_status === 'COMPLIANT').length;
    const warningCount = summaryRecords.filter((r) => r.compliance_status === 'WARNING_90_PERCENT').length;
    const overAllocatedCount = summaryRecords.filter((r) => r.compliance_status === 'OVER_ALLOCATED').length;
    const expiredCount = summaryRecords.filter((r) => r.compliance_status === 'EXPIRED').length;

    let overallUtilization = 0.0;
    if (totalSeats > 0) {
      overallUtilization = Math.round((totalAllocated / totalSeats) * 10000) / 100;
    }

    return {
      overview: {
        total_licenses: totalLicenses,
        total_seats: totalSeats,
        total_allocated: totalAllocated,
        available_seats: Math.max(0, totalSeats - totalAllocated),
        overall_utilization_percent: overallUtilization,
      },
      compliance_breakdown: {
        compliant: compliantCount,
        warning_90_percent: warningCount,
        over_allocated: overAllocatedCount,
        expired: expiredCount,
      },
      licenses: summaryRecords,
    };
  }
}
