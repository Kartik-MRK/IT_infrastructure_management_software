/**
 * Repository layer for SLA Policies, Timers, and Compliance Analytics
 */

import { getSupabase } from '../core/database.js';

export class SLARepository {
  /**
   * Fetch all configured SLA policies ordered by response time
   */
  static async getAllPolicies() {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .table('sla_policies')
      .select('*')
      .order('max_response_time_minutes', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Fetch a specific SLA policy by ID
   */
  static async getPolicyById(policyId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .table('sla_policies')
      .select('*')
      .eq('id', policyId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  /**
   * Fetch an active SLA policy for a specific severity
   */
  static async getPolicyBySeverity(severity) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .table('sla_policies')
      .select('*')
      .eq('severity', severity)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  /**
   * Update SLA policy parameters
   */
  static async updatePolicy(policyId, data) {
    const supabase = getSupabase();
    const updateData = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await supabase
      .table('sla_policies')
      .update(updateData)
      .eq('id', policyId)
      .select();

    if (error) throw error;
    return updated && updated.length > 0 ? updated[0] : null;
  }

  /**
   * Record initial technician acknowledgment / response on an incident
   */
  static async recordFirstResponse(incidentId, responderId) {
    const supabase = getSupabase();
    const nowIso = new Date().toISOString();

    // Fetch current incident record
    const { data: inc, error: fetchErr } = await supabase
      .table('incidents')
      .select('id, response_deadline, first_responded_at, sla_response_breached')
      .eq('id', incidentId)
      .single();

    if (fetchErr && fetchErr.code === 'PGRST116') {
      return { data: null, error: 'Incident not found' };
    }
    if (!inc) {
      return { data: null, error: 'Incident not found' };
    }

    if (inc.first_responded_at) {
      return { data: inc, error: 'Already acknowledged' };
    }

    // Check if response SLA is breached
    let isBreached = false;
    if (inc.response_deadline) {
      const deadlineDt = new Date(inc.response_deadline);
      if (new Date() > deadlineDt) {
        isBreached = true;
      }
    }

    const updatePayload = {
      first_responded_at: nowIso,
      sla_response_breached: isBreached,
    };

    const { data: updated, error: updateErr } = await supabase
      .table('incidents')
      .update(updatePayload)
      .eq('id', incidentId)
      .select();

    if (updateErr) throw updateErr;
    return { data: updated && updated.length > 0 ? updated[0] : null, error: null };
  }

  /**
   * Call PostgreSQL stored function to fetch SLA MTTR, MTTD and compliance rates
   */
  static async getSlaComplianceSummary() {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase.rpc('get_sla_compliance_summary');
      if (error) throw error;
      if (data && Array.isArray(data) && data.length > 0) {
        return data[0];
      }
      return (
        data || {
          total_incidents: 0,
          resolved_incidents: 0,
          resolved_within_sla: 0,
          sla_compliance_percentage: 100.0,
          active_breached_count: 0,
          active_approaching_count: 0,
          avg_mttd_minutes: 0.0,
          avg_mttr_minutes: 0.0,
        }
      );
    } catch {
      return {
        total_incidents: 0,
        resolved_incidents: 0,
        resolved_within_sla: 0,
        sla_compliance_percentage: 100.0,
        active_breached_count: 0,
        active_approaching_count: 0,
        avg_mttd_minutes: 0.0,
        avg_mttr_minutes: 0.0,
      };
    }
  }
}
