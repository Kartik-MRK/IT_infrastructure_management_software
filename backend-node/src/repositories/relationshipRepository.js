import { getSupabase } from '../core/database.js';

export class RelationshipRepository {
  static async getForAsset(assetId) {
    const supabase = getSupabase();

    // Outgoing relationships (asset is parent)
    const outgoing = await supabase
      .table('asset_relationships')
      .select(`
        id, relationship_type, description, created_at,
        child:child_asset_id(id, name, type, status, location)
      `)
      .eq('parent_asset_id', assetId);

    // Incoming relationships (asset is child)
    const incoming = await supabase
      .table('asset_relationships')
      .select(`
        id, relationship_type, description, created_at,
        parent:parent_asset_id(id, name, type, status, location)
      `)
      .eq('child_asset_id', assetId);

    return {
      outgoing: outgoing.data || [],
      incoming: incoming.data || [],
    };
  }

  static async getAll() {
    const supabase = getSupabase();
    return await supabase
      .table('asset_relationships')
      .select(`
        id, parent_asset_id, child_asset_id, relationship_type, description, created_at,
        parent:parent_asset_id(id, name, type, status),
        child:child_asset_id(id, name, type, status)
      `);
  }

  static async create(parentAssetId, childAssetId, relationshipType, description = null, userId = null) {
    const supabase = getSupabase();
    const data = {
      parent_asset_id: parentAssetId,
      child_asset_id: childAssetId,
      relationship_type: relationshipType,
      description,
      created_by: userId,
    };
    return await supabase.table('asset_relationships').insert(data).select();
  }

  static async delete(relationshipId) {
    const supabase = getSupabase();
    return await supabase.table('asset_relationships').delete().eq('id', relationshipId);
  }

  static async calculateBlastRadius(assetId, maxDepth = 5) {
    const supabase = getSupabase();
    try {
      const rpcRes = await supabase.rpc('calculate_blast_radius', {
        root_asset_id: String(assetId),
        max_depth: maxDepth,
      });
      return rpcRes.data || [];
    } catch {
      return [];
    }
  }
}

export default RelationshipRepository;
