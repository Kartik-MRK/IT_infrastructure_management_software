/**
 * Alerts Routes Blueprint
 */

import { Router } from 'express';
import { AlertService } from '../services/alertService.js';
import { roleRequired } from '../core/security.js';

const router = Router();

/**
 * GET /alerts - Aggregated system alerts
 */
router.get('/alerts', roleRequired(['admin', 'operator']), async (req, res) => {
  try {
    const alerts = await AlertService.getSystemAlerts();
    return res.status(200).json({
      alerts,
      count: alerts.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
