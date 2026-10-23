/**
 * Service Layer for CVE Vulnerability Scanning, CVSS Scoring & Incident Remediation
 */

import { validateVulnStatusPayload } from '../schemas/cveSchema.js';
import { CVERepository } from '../repositories/cveRepository.js';

export class CVEService {
  /**
   * Scan asset against CVE cache database and update security findings
   */
  static async scanAsset(assetId) {
    try {
      const scanResult = await CVERepository.scanAsset(assetId);
      return { scanResult, error: null, statusCode: 200 };
    } catch (err) {
      return { scanResult: null, error: `Failed to execute CVE vulnerability scan: ${err.message}`, statusCode: 500 };
    }
  }

  /**
   * Retrieve detected CVE vulnerabilities on an asset
   */
  static async getAssetVulnerabilities(assetId) {
    try {
      const vulns = await CVERepository.getAssetVulnerabilities(assetId);
      return { vulnerabilities: vulns, error: null, statusCode: 200 };
    } catch (err) {
      return { vulnerabilities: [], error: `Failed to retrieve asset vulnerabilities: ${err.message}`, statusCode: 500 };
    }
  }

  /**
   * 1-Click generation of prioritized incident ticket from a CVE finding
   */
  static async createRemediationIncident(vulnId, reporterId = null) {
    try {
      const result = await CVERepository.createRemediationIncident(vulnId, reporterId);
      return { result, error: null, statusCode: 201 };
    } catch (err) {
      return { result: null, error: `Failed to create remediation incident: ${err.message}`, statusCode: 500 };
    }
  }

  /**
   * Update vulnerability lifecycle status
   */
  static async updateVulnStatus(vulnId, payload) {
    const { data: cleaned, error } = validateVulnStatusPayload(payload);
    if (error) {
      return { vulnerability: null, error, statusCode: 400 };
    }

    try {
      const updated = await CVERepository.updateVulnStatus(vulnId, cleaned.status);
      if (!updated) {
        return { vulnerability: null, error: 'Vulnerability record not found', statusCode: 404 };
      }
      return { vulnerability: updated, error: null, statusCode: 200 };
    } catch (err) {
      return { vulnerability: null, error: `Failed to update vulnerability status: ${err.message}`, statusCode: 500 };
    }
  }

  /**
   * Retrieve global vulnerability posture summary
   */
  static async getSystemSummary() {
    try {
      const summary = await CVERepository.getSystemSummary();
      return { summary, error: null, statusCode: 200 };
    } catch (err) {
      return { summary: null, error: `Failed to retrieve vulnerability summary: ${err.message}`, statusCode: 500 };
    }
  }

  /**
   * List all vulnerability findings across the entire infrastructure
   */
  static async listAllVulnerabilities(severity = null, status = null) {
    try {
      const vulns = await CVERepository.listAllVulnerabilities(severity, status);
      return { vulnerabilities: vulns, error: null, statusCode: 200 };
    } catch (err) {
      return { vulnerabilities: [], error: `Failed to list vulnerabilities: ${err.message}`, statusCode: 500 };
    }
  }
}
