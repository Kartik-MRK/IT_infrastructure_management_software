/**
 * Repository Layer for CVE Cache and Asset Vulnerability Data Access
 */

import { getSupabase } from '../core/database.js';

export class CVERepository {
  /**
   * Invoke PostgreSQL scan_asset_for_vulnerabilities stored procedure
   */
  static async scanAsset(assetId) {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('scan_asset_for_vulnerabilities', {
      p_asset_id: String(assetId),
    });
    if (error) throw error;
    return data;
  }

  /**
   * Fetch all vulnerabilities detected on a specific asset
   */
  static async getAssetVulnerabilities(assetId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .table('asset_vulnerabilities')
      .select(`
        *,
        cve:cve_id(cve_id, summary, cvss_score, severity, affected_product, affected_versions, fixed_version, epss_score, cve_references),
        remediation_incident:remediation_incident_id(id, title, status, severity)
      `)
      .eq('asset_id', String(assetId))
      .order('detected_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Invoke PostgreSQL create_remediation_incident_from_cve stored procedure
   */
  static async createRemediationIncident(vulnId, reporterId = null) {
    const supabase = getSupabase();
    const params = { p_vuln_id: String(vulnId) };
    if (reporterId) {
      params.p_reporter_id = String(reporterId);
    }
    const { data, error } = await supabase.rpc('create_remediation_incident_from_cve', params);
    if (error) throw error;
    return data;
  }

  /**
   * Update vulnerability lifecycle status
   */
  static async updateVulnStatus(vulnId, status) {
    const supabase = getSupabase();
    const updateData = { status };
    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .table('asset_vulnerabilities')
      .update(updateData)
      .eq('id', String(vulnId))
      .select();

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  }

  /**
   * Invoke PostgreSQL get_system_vulnerability_summary stored procedure
   */
  static async getSystemSummary() {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_system_vulnerability_summary', {});
    if (error) throw error;
    return data;
  }

  /**
   * List all asset vulnerabilities across infrastructure with optional filters
   */
  static async listAllVulnerabilities(severity = null, status = null) {
    const supabase = getSupabase();
    let query = supabase
      .table('asset_vulnerabilities')
      .select(`
        *,
        asset:asset_id(id, name, type, location),
        cve:cve_id(cve_id, summary, cvss_score, severity, affected_product, fixed_version),
        remediation_incident:remediation_incident_id(id, title, status, severity)
      `)
      .order('detected_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    let results = data || [];

    if (severity) {
      results = results.filter((d) => d?.cve?.severity === severity);
    }

    return results;
  }
}
