/**
 * Repository Layer for Cryptographic Audit Logs & Hash Chaining Procedures
 */

import { getSupabase } from '../core/database.js';

export class CryptoAuditRepository {
  /**
   * Append an immutable hash-chained audit record via stored procedure
   */
  static async appendLog({
    actorId = null,
    actorEmail = 'system@itims.local',
    action,
    entityType,
    entityId,
    payload = {},
    clientIp = '127.0.0.1',
    userAgent = 'ITIMS-Core',
  }) {
    const supabase = getSupabase();
    const params = {
      p_actor_id: actorId ? String(actorId) : null,
      p_actor_email: String(actorEmail),
      p_action: String(action).toUpperCase(),
      p_entity_type: String(entityType).toUpperCase(),
      p_entity_id: String(entityId),
      p_payload: payload || {},
      p_client_ip: String(clientIp),
      p_user_agent: String(userAgent),
    };

    const { data, error } = await supabase.rpc('append_cryptographic_audit_log', params);
    if (error) throw error;
    return data;
  }

  /**
   * Execute full ledger cryptographic integrity sweep
   */
  static async verifyChainIntegrity() {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('verify_audit_log_chain_integrity', {});
    if (error) throw error;
    return data;
  }

  /**
   * Generate signed SOC 2 Type II / ISO 27001 audit certificate
   */
  static async generateComplianceCertificate(auditorName = 'Enterprise Compliance Officer') {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('generate_compliance_certificate', {
      p_auditor_name: String(auditorName),
    });
    if (error) throw error;
    return data;
  }

  /**
   * List audit log entries ordered chronologically by sequence_number desc
   */
  static async listLogs({ limit = 50, offset = 0, action = null } = {}) {
    const supabase = getSupabase();
    let query = supabase
      .table('cryptographic_audit_logs')
      .select(`
        *,
        actor:actor_id(id, full_name, email, role)
      `)
      .order('sequence_number', { ascending: false })
      .range(offset, offset + limit - 1);

    if (action) {
      query = query.ilike('action', `%${action}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
}
