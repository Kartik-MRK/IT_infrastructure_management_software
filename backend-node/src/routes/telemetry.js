/**
 * REST API Endpoints for Telemetry Streaming, Anomaly Detection & Chaos Simulation
 */

import { Router } from 'express';
import { TelemetryService } from '../services/telemetryService.js';
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
 * POST /assets/:id/telemetry - Ingest a real-time metric sample for an asset and evaluate outlier Z-score anomalies
 */
router.post('/assets/:asset_id/telemetry', requireAuth, async (req, res) => {
  try {
    const assetId = req.params.asset_id;
    const autoIncident = req.query.auto_incident !== 'false';
    const { result, error, statusCode } = await TelemetryService.ingestMetric(
      assetId,
      req.body,
      autoIncident
    );

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(statusCode).json({
      result,
      message: 'Telemetry ingested and evaluated',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /assets/:id/telemetry/history - Fetch recent historical time-series samples
 */
router.get('/assets/:asset_id/telemetry/history', requireAuth, async (req, res) => {
  try {
    const assetId = req.params.asset_id;
    const limit = parseInt(req.query.limit || '30', 10);
    const { history, error, statusCode } = await TelemetryService.getAssetHistory(assetId, limit);

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(statusCode).json({
      history,
      count: history.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /telemetry/simulate - Trigger synthetic telemetry simulation tick across all assets
 */
router.post('/telemetry/simulate', requireAuth, async (req, res) => {
  try {
    const { result, error, statusCode } = await TelemetryService.simulateTelemetryTick(req.body);

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(statusCode).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /telemetry/anomalies/summary - System-wide anomaly statistics
 */
router.get('/telemetry/anomalies/summary', requireAuth, async (req, res) => {
  try {
    const { summary, error, statusCode } = await TelemetryService.getSystemSummary();

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(statusCode).json(summary);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
