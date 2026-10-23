import { getSupabase } from '../core/database.js';

export class IncidentRepository {
  static async getAll(statusFilter = null, severityFilter = null, assetIdFilter = null) {
    const supabase = getSupabase();
    let query = supabase.table('incidents').select(`
      *,
      reporter:reported_by(id, email, full_name),
      assignee:assigned_to(id, email, full_name),
      resolver:resolved_by(id, email, full_name),
      asset:asset_id(id, name, type)
    `);

    if (statusFilter) query = query.eq('status', statusFilter);
    if (severityFilter) query = query.eq('severity', severityFilter);
    if (assetIdFilter) query = query.eq('asset_id', assetIdFilter);

    return await query
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
  }

  static async getById(incidentId) {
    const supabase = getSupabase();
    return await supabase
      .table('incidents')
      .select(`
        *,
        reporter:reported_by(id, email, full_name),
        assignee:assigned_to(id, email, full_name),
        resolver:resolved_by(id, email, full_name),
        asset:asset_id(id, name, type, status, location)
      `)
      .eq('id', incidentId)
      .single();
  }

  static async create(incidentData) {
    const supabase = getSupabase();
    return await supabase.table('incidents').insert(incidentData).select();
  }

  static async update(incidentId, updateData) {
    const supabase = getSupabase();
    return await supabase.table('incidents').update(updateData).eq('id', incidentId).select();
  }

  static async delete(incidentId) {
    const supabase = getSupabase();
    return await supabase.table('incidents').delete().eq('id', incidentId);
  }

  static async getSummaryCounts() {
    const supabase = getSupabase();
    try {
      const res = await supabase.table('incidents').select('status, severity');
      const data = res.data || [];
      const openCount = data.filter((inc) => inc.status === 'open').length;
      const criticalCount = data.filter((inc) => inc.severity === 'critical' && inc.status !== 'resolved').length;
      return { openCount, criticalCount };
    } catch {
      return { openCount: 0, criticalCount: 0 };
    }
  }

  static async getRecent(limit = 5) {
    const supabase = getSupabase();
    return await supabase
      .table('incidents')
      .select('id, title, severity, status, created_at, reporter:reported_by(full_name, email), asset:asset_id(name)')
      .order('created_at', { ascending: false })
      .limit(limit);
  }
}

export default IncidentRepository;
