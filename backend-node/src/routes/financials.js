/**
 * Financial Lifecycle, TCO & Depreciation Routes
 */

import { Router } from 'express';
import { FinancialService } from '../services/financialService.js';
import { getCurrentUserId } from '../core/security.js';

const router = Router();

/**
 * GET /financials/executive-summary - Organization-wide financial summary, Net Book Value, and TCO
 */
router.get('/financials/executive-summary', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const { data, error, statusCode } = await FinancialService.getExecutiveFinancialOverview();
    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /financials/depreciation-forecast - 5-year forward projected depreciation curve
 */
router.get('/financials/depreciation-forecast', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const { data, error, statusCode } = await FinancialService.getDepreciationForecast();
    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /assets/:asset_id/financials (and /financials/asset/:asset_id) - Financial lifecycle, depreciation schedule, and TCO
 */
const getAssetFinancialsHandler = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const assetId = req.params.asset_id;
    const { data, error, statusCode } = await FinancialService.getAssetFinancialBreakdown(assetId);
    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

router.get('/assets/:asset_id/financials', getAssetFinancialsHandler);
router.get('/financials/asset/:asset_id', getAssetFinancialsHandler);

export default router;
