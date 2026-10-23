/**
 * REST API Endpoints for Executive Analytics & SRE Command Center
 */

import { Router } from 'express';
import { CommandCenterService } from '../services/commandCenterService.js';
import { getCurrentUserId } from '../core/security.js';

const router = Router();

/**
 * GET /command-center/metrics - Retrieve unified executive and SRE command center dataset
 */
router.get('/command-center/metrics', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const { data, error, statusCode } = await CommandCenterService.getMetrics();
    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json({ command_center: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
