/**
 * Physical Asset Auditing & QR Scanning Routes
 */

import { Router } from 'express';
import { AuditService } from '../services/auditService.js';
import { getCurrentUserId, roleRequired } from '../core/security.js';

const router = Router();

/**
 * GET /audits/summary - Organization-wide physical audit compliance metrics
 */
router.get('/audits/summary', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const { data, error, statusCode } = await AuditService.getAuditComplianceSummary();
    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /audits/recent - Recent physical audits stream
 */
router.get('/audits/recent', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const limit = parseInt(req.query.limit || '20', 10);
    const { data, error, statusCode } = await AuditService.getRecentAudits(limit);
    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /assets/:asset_id/audits (and /audits/asset/:asset_id) - Record a physical asset audit verification
 */
const recordAuditHandler = async (req, res) => {
  try {
    const assetId = req.params.asset_id;
    const { result, error, statusCode } = await AuditService.recordPhysicalAudit(
      assetId,
      req.currentUser.id,
      req.body
    );

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(statusCode).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

router.post(
  '/assets/:asset_id/audits',
  roleRequired(['admin', 'it_admin', 'infrastructure_engineer', 'asset_custodian', 'technician']),
  recordAuditHandler
);
router.post(
  '/audits/asset/:asset_id',
  roleRequired(['admin', 'it_admin', 'infrastructure_engineer', 'asset_custodian', 'technician']),
  recordAuditHandler
);

/**
 * GET /assets/:asset_id/audits (and /audits/asset/:asset_id) - Historical audit timeline for an asset
 */
const getAssetAuditsHandler = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const assetId = req.params.asset_id;
    const { data, error, statusCode } = await AuditService.getAssetAuditHistory(assetId);
    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

router.get('/assets/:asset_id/audits', getAssetAuditsHandler);
router.get('/audits/asset/:asset_id', getAssetAuditsHandler);

export default router;
