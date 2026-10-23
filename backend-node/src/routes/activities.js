/**
 * Live Activity Feed Routes Blueprint
 */

import { Router } from 'express';
import { AlertService } from '../services/alertService.js';
import { getCurrentUserId } from '../core/security.js';

const router = Router();

/**
 * GET /activities - Live activity stream
 */
router.get('/activities', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const activities = await AlertService.getLiveActivities(8);
    return res.status(200).json({ activities });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
