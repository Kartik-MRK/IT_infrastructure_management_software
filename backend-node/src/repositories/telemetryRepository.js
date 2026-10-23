/**
 * Repository for Telemetry Ingestion, History & Stored Anomaly Functions
 */

import { getSupabase } from '../core/database.js';

export class TelemetryRepository {
  /**
   * Invoke PostgreSQL ingest_and_evaluate_telemetry stored procedure
   */
  static async ingestAndEvaluate(assetId, data, autoIncident = true) {
    const supabase = getSupabase();
    const { data: result, error } = await supabase.rpc('ingest_and_evaluate_telemetry', {
      p_asset_id: String(assetId),
      p_cpu: parseFloat(data.cpu_usage),
      p_mem: parseFloat(data.memory_usage),
      p_disk: parseFloat(data.disk_usage),
      p_latency: parseFloat(data.latency_ms !== undefined ? data.latency_ms : 5.0),
      p_error_rate: parseFloat(data.error_rate_percent !== undefined ? data.error_rate_percent : 0.0),
      p_bandwidth: parseFloat(data.bandwidth_usage_mbps !== undefined ? data.bandwidth_usage_mbps : 100.0),
      p_auto_incident: Boolean(autoIncident),
    });

    if (error) throw error;
    return result;
  }

  /**
   * Invoke PostgreSQL get_asset_telemetry_history RPC
   */
  static async getHistory(assetId, limit = 30) {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_asset_telemetry_history', {
      p_asset_id: String(assetId),
      p_limit: parseInt(limit, 10),
    });

    if (error) throw error;
    return data || [];
  }

  /**
   * Invoke PostgreSQL get_system_anomaly_overview RPC
   */
  static async getSystemSummary() {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase.rpc('get_system_anomaly_overview');
      if (error) throw error;
      return (
        data || {
          total_telemetry_samples: 0,
          total_anomalies_detected: 0,
          affected_assets_count: 0,
          recent_anomalies: [],
        }
      );
    } catch {
      return {
        total_telemetry_samples: 0,
        total_anomalies_detected: 0,
        affected_assets_count: 0,
        recent_anomalies: [],
      };
    }
  }

  /**
   * Fetch list of all active assets for simulation batch runs
   */
  static async getActiveAssets() {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .table('assets')
      .select('id, name, type, status')
      .eq('is_active', true);

    if (error) throw error;
    return data || [];
  }
}
