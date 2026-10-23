import { getSupabase } from '../core/database.js';

export class AssetRepository {
  static async getAll(departmentId = null) {
    const supabase = getSupabase();
    let query = supabase.table('assets').select(`
      *,
      creator:created_by(id, email, full_name),
      assignee:assigned_to(id, email, full_name),
      department:department_id(id, name, code)
    `);

    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }
    return await query;
  }

  static async getById(assetId) {
    const supabase = getSupabase();
    return await supabase
      .table('assets')
      .select(`
        *,
        creator:created_by(id, email, full_name),
        assignee:assigned_to(id, email, full_name),
        department:department_id(id, name, code)
      `)
      .eq('id', assetId)
      .single();
  }

  static async create(assetData) {
    const supabase = getSupabase();
    return await supabase.table('assets').insert(assetData).select();
  }

  static async update(assetId, updateData) {
    const supabase = getSupabase();
    return await supabase.table('assets').update(updateData).eq('id', assetId).select();
  }

  static async delete(assetId) {
    const supabase = getSupabase();
    return await supabase.table('assets').delete().eq('id', assetId);
  }

  static async softDelete(assetId) {
    const supabase = getSupabase();
    const nowIso = new Date().toISOString();
    return await supabase.table('assets').update({
      deleted_at: nowIso,
      is_active: false,
      status: 'retired',
    }).eq('id', assetId).select();
  }

  static async getCountsByStatusAndType() {
    const supabase = getSupabase();
    let total = 0;
    try {
      const res = await supabase.table('assets').select('id', { count: 'exact', head: true });
      total = res.count || 0;
    } catch {
      total = 0;
    }

    const statuses = ['active', 'in_use', 'maintenance', 'retired', 'damaged'];
    const byStatus = {};
    for (const s of statuses) {
      try {
        const res = await supabase.table('assets').select('id', { count: 'exact', head: true }).eq('status', s);
        byStatus[s] = res.count || 0;
      } catch {
        byStatus[s] = 0;
      }
    }

    const types = ['hardware', 'software', 'network', 'infrastructure', 'peripherals'];
    const byType = {};
    for (const t of types) {
      try {
        const res = await supabase.table('assets').select('id', { count: 'exact', head: true }).eq('type', t);
        byType[t] = res.count || 0;
      } catch {
        byType[t] = 0;
      }
    }

    return { total, byStatus, byType };
  }

  static async getLatestMetrics(assetId) {
    const supabase = getSupabase();
    return await supabase
      .table('asset_metrics')
      .select('*')
      .eq('asset_id', assetId)
      .order('last_updated', { ascending: false })
      .limit(1);
  }

  static async getProblematicAssets() {
    const supabase = getSupabase();
    return await supabase.table('assets').select('*').in('status', ['maintenance', 'damaged']);
  }

  static async getRecent(limit = 5) {
    const supabase = getSupabase();
    return await supabase
      .table('assets')
      .select('id, name, type, status, created_at, creator:created_by(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(limit);
  }

  static async bulkUpdateStatus(assetIds, newStatus) {
    if (!assetIds || assetIds.length === 0) return null;
    const supabase = getSupabase();
    return await supabase.table('assets').update({ status: newStatus }).in('id', assetIds).select();
  }

  static async bulkDelete(assetIds) {
    if (!assetIds || assetIds.length === 0) return null;
    const supabase = getSupabase();
    return await supabase.table('assets').delete().in('id', assetIds);
  }
}

export default AssetRepository;
