import { Router } from 'express';
import QRCode from 'qrcode';
import { AssetService } from '../services/assetService.js';
import { RelationshipService } from '../services/relationshipService.js';
import { getCurrentUserId, getUserProfile, roleRequired } from '../core/security.js';

const router = Router();

/**
 * GET /assets/summary - Overall asset status and count metrics
 */
router.get('/assets/summary', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }
    const summary = await AssetService.getSummary();
    return res.status(200).json({ summary });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /assets/topology - Global infrastructure topology
 */
router.get('/assets/topology', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }
    const { data, error, statusCode } = await RelationshipService.getTopology(null);
    if (error) {
      return res.status(statusCode).json({ error });
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /assets/bulk-status - Batch status update
 */
router.post('/assets/bulk-status', roleRequired(['admin', 'operator', 'infrastructure_engineer', 'asset_custodian']), async (req, res) => {
  try {
    const { asset_ids, status } = req.body || {};
    const { data, error, statusCode } = await AssetService.bulkUpdateStatus(asset_ids, status);
    if (error) {
      return res.status(statusCode).json({ error });
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /assets/bulk-delete - Batch delete
 */
router.post('/assets/bulk-delete', roleRequired(['admin', 'it_admin']), async (req, res) => {
  try {
    const { asset_ids } = req.body || {};
    const { data, error, statusCode } = await AssetService.bulkDelete(asset_ids);
    if (error) {
      return res.status(statusCode).json({ error });
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /assets/relationships/:rel_id - Delete CMDB dependency edge
 */
router.delete('/assets/relationships/:relationship_id', roleRequired(['admin', 'it_admin', 'operator', 'infrastructure_engineer']), async (req, res) => {
  try {
    const { message, statusCode } = await RelationshipService.deleteRelationship(req.params.relationship_id);
    return res.status(statusCode).json({ message });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /assets - List all assets
 */
router.get('/assets', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }
    const profile = await getUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const assets = await AssetService.getAllAssets();
    return res.status(200).json({
      assets,
      count: assets.length,
      user_role: profile.role || 'viewer',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /assets - Create new asset
 */
router.post('/assets', roleRequired(['admin', 'operator', 'infrastructure_engineer', 'asset_custodian']), async (req, res) => {
  try {
    const { asset, error, statusCode } = await AssetService.createAsset(req.body, req.currentUser.id);
    if (error) {
      return res.status(statusCode).json({ error });
    }
    return res.status(201).json({
      message: 'Asset created successfully',
      asset,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /assets/:id - Get single asset details
 */
router.get('/assets/:asset_id', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const asset = await AssetService.getAssetById(req.params.asset_id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    return res.status(200).json({ asset });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /assets/:id - Update asset
 */
router.put('/assets/:asset_id', roleRequired(['admin', 'operator', 'infrastructure_engineer', 'asset_custodian']), async (req, res) => {
  try {
    const { asset, error, statusCode } = await AssetService.updateAsset(req.params.asset_id, req.body, req.currentUser);
    if (error) {
      return res.status(statusCode).json({ error, message: error });
    }
    return res.status(200).json({
      message: 'Asset updated successfully',
      asset,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /assets/:id - Delete asset
 */
router.delete('/assets/:asset_id', roleRequired(['admin', 'it_admin']), async (req, res) => {
  try {
    const { message, statusCode } = await AssetService.deleteAsset(req.params.asset_id);
    return res.status(statusCode).json({ message });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /assets/:id/metrics - Latest asset metrics
 */
router.get('/assets/:asset_id/metrics', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }
    const metrics = await AssetService.getLatestMetrics(req.params.asset_id);
    if (metrics) {
      return res.status(200).json({ metrics });
    }
    return res.status(200).json({ metrics: null, message: 'No metrics available for this asset' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /assets/:id/qr - Generate QR Code image or Data URL for physical auditing
 */
router.get('/assets/:asset_id/qr', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const asset = await AssetService.getAssetById(req.params.asset_id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const payload = JSON.stringify({
      id: asset.id,
      name: asset.name,
      serial_number: asset.serial_number || '',
      type: asset.type,
      location: asset.location || '',
    });

    if (req.query.format === 'png') {
      const buffer = await QRCode.toBuffer(payload);
      res.setHeader('Content-Type', 'image/png');
      return res.send(buffer);
    }

    const qrDataUrl = await QRCode.toDataURL(payload);
    return res.status(200).json({
      asset_id: asset.id,
      qr_code: qrDataUrl,
      payload,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /assets/:id/relationships - Direct upstream & downstream dependencies
 */
router.get('/assets/:asset_id/relationships', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const rels = await RelationshipService.getRelationshipsForAsset(req.params.asset_id);
    return res.status(200).json(rels);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /assets/:id/relationships - Create dependency edge
 */
router.post('/assets/:asset_id/relationships', roleRequired(['admin', 'it_admin', 'operator', 'infrastructure_engineer']), async (req, res) => {
  try {
    const data = req.body || {};
    const parentAssetId = data.parent_asset_id || req.params.asset_id;
    const childAssetId = data.child_asset_id;
    const relationshipType = data.relationship_type;
    const description = data.description;

    const { relationship, error, statusCode } = await RelationshipService.createRelationship(
      parentAssetId,
      childAssetId,
      relationshipType,
      description,
      req.currentUser.id
    );

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(201).json({
      message: 'Relationship created successfully',
      relationship,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /assets/:id/blast-radius - Calculate outage cascading blast radius
 */
router.get('/assets/:asset_id/blast-radius', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const maxDepth = parseInt(req.query.max_depth || '5', 10);
    const { data, error, statusCode } = await RelationshipService.getBlastRadius(req.params.asset_id, maxDepth);

    if (error) {
      return res.status(statusCode).json({ error });
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /assets/:id/topology - Centered subgraph topology
 */
router.get('/assets/:asset_id/topology', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const { data, error, statusCode } = await RelationshipService.getTopology(req.params.asset_id);
    if (error) {
      return res.status(statusCode).json({ error });
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
