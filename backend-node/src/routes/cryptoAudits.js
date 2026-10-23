/**
 * REST API Endpoints for Cryptographic Audit Logging & Chain Integrity Sweeps
 */

import { Router } from 'express';
import { CryptoAuditService } from '../services/cryptoAuditService.js';
import { getCurrentUserId, getUserProfile } from '../core/security.js';

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
 * POST /audit-ledger/verify - Execute complete cryptographic hash chain verification sweep
 */
router.post('/audit-ledger/verify', requireAuth, async (req, res) => {
  try {
    const { result, error, statusCode } = await CryptoAuditService.verifyChainIntegrity();
    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json({
      integrity_report: result,
      message: 'Cryptographic integrity sweep completed',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET/POST /audit-ledger/compliance-certificate - Generate signed SOC 2 Type II certificate
 */
const complianceCertificateHandler = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const profile = await getUserProfile(userId);
    const bodyAuditor = req.query.auditor_name || req.body?.auditor_name;
    const auditorName = bodyAuditor || profile?.full_name || profile?.email || 'Enterprise Compliance Officer';

    const { certificate, error, statusCode } = await CryptoAuditService.generateComplianceCertificate({
      auditor_name: auditorName,
    });

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json({ certificate });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

router.get('/audit-ledger/compliance-certificate', requireAuth, complianceCertificateHandler);
router.post('/audit-ledger/compliance-certificate', requireAuth, complianceCertificateHandler);

/**
 * GET /audit-ledger - List immutable hash-chained audit log records
 */
router.get('/audit-ledger', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const offset = parseInt(req.query.offset || '0', 10);
    const action = req.query.action || null;

    const { logs, error, statusCode } = await CryptoAuditService.listLogs({
      limit,
      offset,
      action,
    });

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json({
      audit_logs: logs,
      count: logs.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /audit-ledger/log - Append custom cryptographic audit log entry
 */
router.post('/audit-ledger/log', requireAuth, async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const profile = await getUserProfile(userId);
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'ITIMS-Web-Client';

    const { record, error, statusCode } = await CryptoAuditService.appendLog({
      payload: req.body,
      actorId: userId,
      actorEmail: profile?.email || 'system@itims.local',
      clientIp,
      userAgent,
    });

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(201).json({
      audit_entry: record,
      message: 'Audit log appended to cryptographic chain',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
