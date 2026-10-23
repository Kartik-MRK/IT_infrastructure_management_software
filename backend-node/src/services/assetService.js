import { AssetRepository } from '../repositories/assetRepository.js';
import { IncidentRepository } from '../repositories/incidentRepository.js';
import { validateAssetPayload } from '../schemas/assetSchema.js';

export class AssetService {
  static async getAllAssets(departmentId = null) {
    const response = await AssetRepository.getAll(departmentId);
    return response.data || [];
  }

  static async getAssetById(assetId) {
    const response = await AssetRepository.getById(assetId);
    return response.data || null;
  }

  static async createAsset(rawData, currentUserId) {
    const { cleaned, error } = validateAssetPayload(rawData, false);
    if (error) {
      return { asset: null, error, statusCode: 400 };
    }

    cleaned.created_by = currentUserId;
    const response = await AssetRepository.create(cleaned);

    if (response.data && response.data.length > 0) {
      return { asset: response.data[0], error: null, statusCode: 201 };
    }
    return { asset: null, error: 'Failed to create asset in database', statusCode: 500 };
  }

  static async updateAsset(assetId, rawData, currentUser) {
    const existingRes = await AssetRepository.getById(assetId);
    if (!existingRes.data) {
      return { asset: null, error: 'Asset not found', statusCode: 404 };
    }

    const existing = existingRes.data;

    // Operator can only edit assets they created
    if (currentUser.role === 'operator' && existing.created_by !== currentUser.id) {
      return { asset: null, error: 'Operators can only edit assets they created', statusCode: 403 };
    }

    const { cleaned, error } = validateAssetPayload(rawData, true);
    if (error) {
      return { asset: null, error, statusCode: 400 };
    }

    if (Object.keys(cleaned).length === 0) {
      return { asset: null, error: 'No valid fields to update', statusCode: 400 };
    }

    delete cleaned.created_by;

    const response = await AssetRepository.update(assetId, cleaned);
    if (response.data && response.data.length > 0) {
      return { asset: response.data[0], error: null, statusCode: 200 };
    }
    return { asset: null, error: 'Failed to update asset', statusCode: 500 };
  }

  static async deleteAsset(assetId) {
    const existingRes = await AssetRepository.getById(assetId);
    if (!existingRes.data) {
      return { success: false, message: 'Asset not found', statusCode: 404 };
    }

    await AssetRepository.delete(assetId);
    return { success: true, message: 'Asset deleted successfully', statusCode: 200 };
  }

  static async getSummary() {
    const { total, byStatus, byType } = await AssetRepository.getCountsByStatusAndType();
    const { openCount, criticalCount } = await IncidentRepository.getSummaryCounts();

    return {
      total,
      by_status: byStatus,
      by_type: byType,
      incidents: {
        open: openCount,
        critical: criticalCount,
      },
    };
  }

  static async getLatestMetrics(assetId) {
    const res = await AssetRepository.getLatestMetrics(assetId);
    if (res.data && res.data.length > 0) {
      return res.data[0];
    }
    return null;
  }

  static async bulkUpdateStatus(assetIds, newStatus) {
    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return { data: null, error: 'asset_ids list is required', statusCode: 400 };
    }
    const validStatuses = new Set(['active', 'in_use', 'maintenance', 'retired', 'damaged']);
    if (!validStatuses.has(newStatus)) {
      return {
        data: null,
        error: `Invalid status '${newStatus}'. Must be one of: ${Array.from(validStatuses).sort().join(', ')}`,
        statusCode: 400,
      };
    }

    try {
      await AssetRepository.bulkUpdateStatus(assetIds, newStatus);
      return {
        data: { updated_count: assetIds.length, status: newStatus },
        error: null,
        statusCode: 200,
      };
    } catch (err) {
      return { data: null, error: err.message, statusCode: 500 };
    }
  }

  static async bulkDelete(assetIds) {
    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return { data: null, error: 'asset_ids list is required', statusCode: 400 };
    }

    try {
      await AssetRepository.bulkDelete(assetIds);
      return {
        data: { deleted_count: assetIds.length },
        error: null,
        statusCode: 200,
      };
    } catch (err) {
      return { data: null, error: err.message, statusCode: 500 };
    }
  }
}

export default AssetService;
