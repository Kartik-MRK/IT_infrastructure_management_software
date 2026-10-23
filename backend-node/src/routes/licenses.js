/**
 * Software License Management & Compliance Routes
 */

import { Router } from 'express';
import { LicenseService } from '../services/licenseService.js';
import { getCurrentUserId, roleRequired } from '../core/security.js';

const router = Router();

/**
 * GET /licenses/compliance-summary - Retrieve high-level license compliance and seat utilization summary
 */
router.get('/licenses/compliance-summary', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const dashboardData = await LicenseService.getComplianceDashboard();
    return res.status(200).json(dashboardData);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /licenses - List all software licenses with seat utilization metrics
 */
router.get('/licenses', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const softwareAssetId = req.query.software_asset_id || null;
    const departmentId = req.query.department_id || null;

    const licenses = await LicenseService.getAllLicenses({
      softwareAssetId,
      departmentId,
    });

    return res.status(200).json({
      licenses,
      count: licenses.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /licenses - Create a new software license
 */
router.post(
  '/licenses',
  roleRequired(['admin', 'it_admin', 'infrastructure_engineer', 'asset_custodian']),
  async (req, res) => {
    try {
      const { license, error, statusCode } = await LicenseService.createLicense(req.body, req.currentUser.id);
      if (error) {
        return res.status(statusCode).json({ error });
      }

      return res.status(201).json({
        message: 'Software license created successfully',
        license,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

/**
 * GET /licenses/:id - Fetch single license with full allocation roster
 */
router.get('/licenses/:license_id', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const license = await LicenseService.getLicenseById(req.params.license_id);
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }

    return res.status(200).json({ license });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /licenses/:id - Update software license details
 */
router.put(
  '/licenses/:license_id',
  roleRequired(['admin', 'it_admin', 'infrastructure_engineer', 'asset_custodian']),
  async (req, res) => {
    try {
      const { license, error, statusCode } = await LicenseService.updateLicense(req.params.license_id, req.body);
      if (error) {
        return res.status(statusCode).json({ error });
      }

      return res.status(200).json({
        message: 'License updated successfully',
        license,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

/**
 * DELETE /licenses/:id - Delete software license
 */
router.delete(
  '/licenses/:license_id',
  roleRequired(['admin', 'it_admin', 'asset_custodian']),
  async (req, res) => {
    try {
      const { message, statusCode } = await LicenseService.deleteLicense(req.params.license_id);
      return res.status(statusCode).json({ message });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

/**
 * POST /licenses/:id/allocate - Allocate a license seat to workstation or user
 */
router.post(
  '/licenses/:license_id/allocate',
  roleRequired(['admin', 'it_admin', 'infrastructure_engineer', 'asset_custodian']),
  async (req, res) => {
    try {
      const { allocation, error, statusCode } = await LicenseService.allocateSeat(
        req.params.license_id,
        req.body
      );
      if (error) {
        return res.status(statusCode).json({ error });
      }

      return res.status(201).json({
        message: 'License seat allocated successfully',
        allocation,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

/**
 * DELETE /licenses/allocations/:id - Revoke or reclaim an allocated license seat
 */
router.delete(
  '/licenses/allocations/:allocation_id',
  roleRequired(['admin', 'it_admin', 'infrastructure_engineer', 'asset_custodian']),
  async (req, res) => {
    try {
      const { message, statusCode } = await LicenseService.reclaimSeat(req.params.allocation_id);
      return res.status(statusCode).json({ message });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

export default router;
