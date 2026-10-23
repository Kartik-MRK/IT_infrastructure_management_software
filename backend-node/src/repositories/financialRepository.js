/**
 * Financial Lifecycle & TCO Repository for Database Access
 */

import { getSupabase } from '../core/database.js';

export class FinancialRepository {
  /**
   * Invoke PostgreSQL calculate_asset_financials stored procedure
   */
  static async getAssetFinancials(assetId) {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase.rpc('calculate_asset_financials', {
        target_asset_id: String(assetId),
      });

      if (error) throw error;
      if (data && Array.isArray(data) && data.length > 0) {
        return data[0];
      }
      return null;
    } catch (err) {
      console.warn(`⚠️ calculate_asset_financials RPC error: ${err.message}`);
      return null;
    }
  }

  /**
   * Invoke PostgreSQL get_executive_financial_summary stored procedure
   */
  static async getExecutiveSummary() {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase.rpc('get_executive_financial_summary');
      if (error) throw error;

      if (data) {
        if (Array.isArray(data) && data.length > 0) {
          const first = data[0];
          if (first && typeof first === 'object' && 'get_executive_financial_summary' in first) {
            return first.get_executive_financial_summary;
          }
          return first;
        }
        return data;
      }
      return null;
    } catch (err) {
      console.warn(`⚠️ get_executive_financial_summary RPC error: ${err.message}`);
      return null;
    }
  }

  /**
   * Fetch all maintenance incidents contributing to an asset's OpEx
   */
  static async getAssetMaintenanceIncidents(assetId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .table('incidents')
      .select('id, title, severity, status, maintenance_cost, created_at, resolved_at')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Fetch all active assets for forward depreciation budget forecasting
   */
  static async getAllActiveAssets() {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .table('assets')
      .select('id, name, type, cost, salvage_value, useful_life_years, depreciation_method, purchase_date')
      .eq('is_active', true)
      .is('deleted_at', null);

    if (error) throw error;
    return data || [];
  }
}
