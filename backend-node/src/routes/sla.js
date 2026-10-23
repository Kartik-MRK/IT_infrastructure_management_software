/**
 * REST API Endpoints for Service Level Agreement (SLA) Engine
 */

import { Router } from 'express';
import { SLAService } from '../services/slaService.js';
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
 * GET /sla/policies - List all configured SLA policies
 */
router.get('/sla/policies', requireAuth, async (req, res) => {
  try {
    const { policies, error, statusCode } = await SLAService.getAllPolicies();
    if (error) {
      return res.status(statusCode).json({ error });
    }
    return res.status(200).json({ policies });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /sla/policies/:id - Update SLA policy targets (admin only)
 */
router.put('/sla/policies/:policy_id', requireAuth, async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const userProfile = await getUserProfile(userId);
    const { policy, error, statusCode } = await SLAService.updatePolicy(
      req.params.policy_id,
      req.body,
      userProfile
    );

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json({
      policy,
      message: 'SLA Policy updated successfully',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /incidents/:id/acknowledge - Acknowledge incident to capture first response timestamp
 */
router.post('/incidents/:incident_id/acknowledge', requireAuth, async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const { incident, error, statusCode } = await SLAService.acknowledgeIncident(
      req.params.incident_id,
      userId
    );

    if (error && statusCode !== 200) {
      return res.status(statusCode).json({ error });
    }

    return res.status(statusCode).json({
      incident,
      message: error || 'Incident acknowledged successfully',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /sla/summary - Organization-wide SLA compliance metrics, MTTR, and MTTD
 */
router.get('/sla/summary', requireAuth, async (req, res) => {
  try {
    const { summary, error, statusCode } = await SLAService.getSlaComplianceSummary();
    if (error) {
      return res.status(statusCode).json({ error });
    }
    return res.status(200).json(summary);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
