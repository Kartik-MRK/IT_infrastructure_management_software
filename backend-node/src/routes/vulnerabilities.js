/**
 * REST API Endpoints for CVE Vulnerability Scans, Posture & Incident Remediation
 */

import { Router } from 'express';
import { CVEService } from '../services/cveService.js';
import { getCurrentUserId } from '../core/security.js';

const router = Router();

/**
 * Middleware ensuring authentication
 */
const requireAuth = (req, res, next) => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
  }
  next();
};

/**
 * POST /assets/:id/scan-vulnerabilities - Execute vulnerability scan on target asset
 */
router.post('/assets/:asset_id/scan-vulnerabilities', requireAuth, async (req, res) => {
  try {
    const { scanResult, error, statusCode } = await CVEService.scanAsset(req.params.asset_id);
    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json({
      scan_result: scanResult,
      message: 'Vulnerability scan completed',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /assets/:id/vulnerabilities - Retrieve all detected CVE vulnerabilities on an asset
 */
router.get('/assets/:asset_id/vulnerabilities', requireAuth, async (req, res) => {
  try {
    const { vulnerabilities, error, statusCode } = await CVEService.getAssetVulnerabilities(
      req.params.asset_id
    );

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json({
      vulnerabilities,
      count: vulnerabilities.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /vulnerabilities/:id/create-incident - 1-Click creation of automated remediation incident
 */
router.post('/vulnerabilities/:vuln_id/create-incident', requireAuth, async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const { result, error, statusCode } = await CVEService.createRemediationIncident(
      req.params.vuln_id,
      userId
    );

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(statusCode).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /vulnerabilities/:id/status - Update lifecycle status of a vulnerability finding
 */
router.put('/vulnerabilities/:vuln_id/status', requireAuth, async (req, res) => {
  try {
    const { vulnerability, error, statusCode } = await CVEService.updateVulnStatus(
      req.params.vuln_id,
      req.body
    );

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json({
      vulnerability,
      message: 'Status updated successfully',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /vulnerabilities/summary - Global vulnerability posture scorecard
 */
router.get('/vulnerabilities/summary', requireAuth, async (req, res) => {
  try {
    const { summary, error, statusCode } = await CVEService.getSystemSummary();
    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json({ summary });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /vulnerabilities - List all vulnerability findings across the infrastructure
 */
router.get('/vulnerabilities', requireAuth, async (req, res) => {
  try {
    const severity = req.query.severity || null;
    const status = req.query.status || null;
    const { vulnerabilities, error, statusCode } = await CVEService.listAllVulnerabilities(
      severity,
      status
    );

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json({
      vulnerabilities,
      count: vulnerabilities.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
