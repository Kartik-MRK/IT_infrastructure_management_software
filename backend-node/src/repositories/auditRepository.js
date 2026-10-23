/**
 * Physical Audit Repository for Database Access
 */

import { getSupabase } from '../core/database.js';

export class AuditRepository {
  /**
   * Invoke PostgreSQL record_asset_physical_audit stored procedure
   */
  static async recordAudit(assetId, auditorId, auditData) {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase.rpc('record_asset_physical_audit', {
        p_asset_id: String(assetId),
        p_auditor_id: String(auditorId),
        p_location_verified: auditData.location_verified !== undefined ? auditData.location_verified : true,
        p_observed_location: auditData.observed_location || null,
        p_status_verified: auditData.status_verified !== undefined ? auditData.status_verified : true,
        p_observed_status: auditData.observed_status || null,
        p_physical_condition: auditData.physical_condition || 'good',
        p_scan_method: auditData.scan_method || 'camera_qr',
        p_notes: auditData.notes || null,
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn(`⚠️ record_asset_physical_audit RPC error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Fetch chronological physical audit history for an asset
   */
  static async getAssetAudits(assetId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .table('asset_audits')
      .select(`
        id, audited_at, location_verified, observed_location,
        status_verified, observed_status, physical_condition,
        scan_method, notes, created_at,
        auditor:auditor_id(id, email, full_name, role)
      `)
      .eq('asset_id', assetId)
      .order('audited_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Fetch global feed of recent physical audits
   */
  static async getRecentAudits(limit = 20) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .table('asset_audits')
      .select(`
        id, audited_at, location_verified, observed_location,
        status_verified, observed_status, physical_condition,
        scan_method, notes,
        asset:asset_id(id, name, type, status, location),
        auditor:auditor_id(id, email, full_name, role)
      `)
      .order('audited_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Invoke PostgreSQL get_physical_audit_summary stored procedure
   */
  static async getSummary() {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase.rpc('get_physical_audit_summary');
      if (error) throw error;

      if (data) {
        if (Array.isArray(data) && data.length > 0) {
          const first = data[0];
          if (first && typeof first === 'object' && 'get_physical_audit_summary' in first) {
            return first.get_physical_audit_summary;
          }
          return first;
        }
        return data;
      }
      return null;
    } catch (err) {
      console.warn(`⚠️ get_physical_audit_summary RPC error: ${err.message}`);
      return null;
    }
  }
}
