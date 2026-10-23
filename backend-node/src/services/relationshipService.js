import { RelationshipRepository } from '../repositories/relationshipRepository.js';
import { AssetRepository } from '../repositories/assetRepository.js';

export const VALID_RELATIONSHIP_TYPES = new Set(['hosts', 'connects_to', 'depends_on', 'backs_up']);

export class RelationshipService {
  static async getRelationshipsForAsset(assetId) {
    return await RelationshipRepository.getForAsset(assetId);
  }

  static async createRelationship(parentAssetId, childAssetId, relationshipType, description = null, userId = null) {
    if (!parentAssetId || !childAssetId) {
      return { relationship: null, error: 'parent_asset_id and child_asset_id are required', statusCode: 400 };
    }

    if (parentAssetId === childAssetId) {
      return {
        relationship: null,
        error: 'An asset cannot have a relationship with itself (self-loop forbidden)',
        statusCode: 400,
      };
    }

    const relType = String(relationshipType || '').trim().toLowerCase();
    if (!VALID_RELATIONSHIP_TYPES.has(relType)) {
      return {
        relationship: null,
        error: `Invalid relationship_type. Must be one of: ${Array.from(VALID_RELATIONSHIP_TYPES).sort().join(', ')}`,
        statusCode: 400,
      };
    }

    // Verify both assets exist
    const parentRes = await AssetRepository.getById(parentAssetId);
    if (!parentRes.data) {
      return { relationship: null, error: `Parent asset '${parentAssetId}' does not exist`, statusCode: 404 };
    }

    const childRes = await AssetRepository.getById(childAssetId);
    if (!childRes.data) {
      return { relationship: null, error: `Child asset '${childAssetId}' does not exist`, statusCode: 404 };
    }

    try {
      const res = await RelationshipRepository.create(parentAssetId, childAssetId, relType, description, userId);
      if (res.data && res.data.length > 0) {
        return { relationship: res.data[0], error: null, statusCode: 201 };
      }
      return { relationship: null, error: 'Failed to record relationship in database', statusCode: 500 };
    } catch (err) {
      const errMsg = err.message || '';
      if (errMsg.includes('uq_asset_relationship') || errMsg.includes('duplicate key')) {
        return { relationship: null, error: 'This relationship already exists between these assets', statusCode: 409 };
      }
      return { relationship: null, error: errMsg, statusCode: 500 };
    }
  }

  static async deleteRelationship(relationshipId) {
    await RelationshipRepository.delete(relationshipId);
    return { success: true, message: 'Relationship deleted successfully', statusCode: 200 };
  }

  static async getBlastRadius(assetId, maxDepth = 5) {
    const rootRes = await AssetRepository.getById(assetId);
    if (!rootRes.data) {
      return { data: null, error: 'Asset not found', statusCode: 404 };
    }

    const rootAsset = rootRes.data;
    const impactedRecords = await RelationshipRepository.calculateBlastRadius(assetId, maxDepth);

    const totalImpacted = impactedRecords.length;
    const directCount = impactedRecords.filter((item) => item.depth === 1).length;
    const secondaryCount = impactedRecords.filter((item) => item.depth === 2).length;
    const tertiaryCount = impactedRecords.filter((item) => (item.depth || 0) >= 3).length;

    let riskLevel = 'LOW';
    if (totalImpacted >= 5 || impactedRecords.some((item) => ['infrastructure', 'network'].includes(item.asset_type))) {
      riskLevel = 'CRITICAL';
    } else if (totalImpacted >= 2) {
      riskLevel = 'HIGH';
    } else if (totalImpacted === 1) {
      riskLevel = 'MEDIUM';
    }

    return {
      data: {
        root_asset: {
          id: rootAsset.id,
          name: rootAsset.name,
          type: rootAsset.type,
          status: rootAsset.status,
        },
        risk_level: riskLevel,
        summary: {
          total_impacted: totalImpacted,
          direct_impact: directCount,
          secondary_impact: secondaryCount,
          tertiary_impact: tertiaryCount,
        },
        impacted_assets: impactedRecords,
      },
      error: null,
      statusCode: 200,
    };
  }

  static async getTopology(assetId = null) {
    if (assetId) {
      const rootRes = await AssetRepository.getById(assetId);
      if (!rootRes.data) {
        return { data: null, error: 'Asset not found', statusCode: 404 };
      }

      const root = rootRes.data;
      const directRels = await RelationshipRepository.getForAsset(assetId);

      const nodes = [];
      const edges = [];
      const seenNodeIds = new Set();

      // 1. Root Node
      nodes.push({
        id: root.id,
        type: 'custom',
        position: { x: 350, y: 250 },
        data: {
          id: root.id,
          label: root.name,
          type: root.type,
          status: root.status,
          isRoot: true,
          role: 'Root Subject',
        },
      });
      seenNodeIds.add(root.id);

      // 2. Upstream Dependencies
      const upstreamY = 70;
      const upstreamXStart = 100;
      directRels.incoming.forEach((rel, idx) => {
        const parent = rel.parent;
        if (!parent) return;
        if (!seenNodeIds.has(parent.id)) {
          nodes.push({
            id: parent.id,
            type: 'custom',
            position: { x: upstreamXStart + idx * 250, y: upstreamY },
            data: {
              id: parent.id,
              label: parent.name,
              type: parent.type,
              status: parent.status,
              isRoot: false,
              role: 'Upstream Provider',
            },
          });
          seenNodeIds.add(parent.id);
        }

        edges.push({
          id: `edge_${rel.id}`,
          source: parent.id,
          target: root.id,
          label: rel.relationship_type,
          animated: true,
        });
      });

      // 3. Downstream Dependencies
      const downstreamY = 430;
      const downstreamXStart = 100;
      directRels.outgoing.forEach((rel, idx) => {
        const child = rel.child;
        if (!child) return;
        if (!seenNodeIds.has(child.id)) {
          nodes.push({
            id: child.id,
            type: 'custom',
            position: { x: downstreamXStart + idx * 250, y: downstreamY },
            data: {
              id: child.id,
              label: child.name,
              type: child.type,
              status: child.status,
              isRoot: false,
              role: 'Downstream Dependent',
            },
          });
          seenNodeIds.add(child.id);
        }

        edges.push({
          id: `edge_${rel.id}`,
          source: root.id,
          target: child.id,
          label: rel.relationship_type,
          animated: true,
        });
      });

      return {
        data: { nodes, edges, root_asset_id: root.id },
        error: null,
        statusCode: 200,
      };
    }

    // Global topology
    const allAssetsRes = await AssetRepository.getAll();
    const assets = allAssetsRes.data || [];
    const allRelsRes = await RelationshipRepository.getAll();
    const rels = allRelsRes.data || [];

    const nodes = assets.map((a, idx) => ({
      id: a.id,
      type: 'custom',
      position: { x: 100 + (idx % 4) * 260, y: 100 + Math.floor(idx / 4) * 160 },
      data: {
        id: a.id,
        label: a.name,
        type: a.type,
        status: a.status,
        isRoot: false,
      },
    }));

    const edges = rels.map((r) => ({
      id: `edge_${r.id}`,
      source: r.parent_asset_id,
      target: r.child_asset_id,
      label: r.relationship_type,
      animated: true,
    }));

    return {
      data: { nodes, edges },
      error: null,
      statusCode: 200,
    };
  }
}

export default RelationshipService;
