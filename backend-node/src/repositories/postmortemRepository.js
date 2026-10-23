/**
 * Repository Layer for Post-Mortem Documents & RCA Data Access
 */

import { getSupabase } from '../core/database.js';

export class PostMortemRepository {
  /**
   * Invoke PostgreSQL generate_incident_postmortem_draft stored procedure
   */
  static async generateDraft(incidentId, authorId = null) {
    const supabase = getSupabase();
    const params = { p_incident_id: String(incidentId) };
    if (authorId) {
      params.p_author_id = String(authorId);
    }
    const { data, error } = await supabase.rpc('generate_incident_postmortem_draft', params);
    if (error) throw error;
    return data;
  }

  /**
   * Fetch post-mortem document for a specific incident
   */
  static async getByIncidentId(incidentId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .table('incident_postmortems')
      .select(`
        *,
        author:author_id(id, full_name, email),
        incident:incident_id(id, title, severity, status, category, reported_at, resolved_at)
      `)
      .eq('incident_id', String(incidentId))
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  /**
   * Update fields of an existing post-mortem report
   */
  static async updatePostmortem(incidentId, data) {
    const supabase = getSupabase();
    const updateData = {
      ...data,
      updated_at: new Date().toISOString(),
    };
    if (data.status === 'published') {
      updateData.published_at = new Date().toISOString();
    }

    const { data: updated, error } = await supabase
      .table('incident_postmortems')
      .update(updateData)
      .eq('incident_id', String(incidentId))
      .select();

    if (error) throw error;
    return updated && updated.length > 0 ? updated[0] : null;
  }

  /**
   * List all post-mortem reports with optional status filter
   */
  static async listPostmortems(status = null) {
    const supabase = getSupabase();
    let query = supabase
      .table('incident_postmortems')
      .select(`
        *,
        author:author_id(id, full_name, email),
        incident:incident_id(id, title, severity, status, category)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
}
