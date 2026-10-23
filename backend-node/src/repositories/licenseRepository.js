/**
 * Software License Repository for Database Access
 */

import { getSupabase } from '../core/database.js';

export class LicenseRepository {
  /**
   * List all software licenses with related asset, department, and allocations
   */
  static async getAll({ softwareAssetId = null, departmentId = null } = {}) {
    const supabase = getSupabase();
    let query = supabase.table('software_licenses').select(`
      *,
      software_asset:software_asset_id(id, name, type, status),
      department:department_id(id, name, code),
      allocations:license_allocations(id, allocated_to_asset_id, allocated_to_user_id, assigned_at)
    `);

    if (softwareAssetId) {
      query = query.eq('software_asset_id', softwareAssetId);
    }
    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  /**
   * Fetch single license by ID with complete allocation roster
   */
  static async getById(licenseId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .table('software_licenses')
      .select(`
        *,
        software_asset:software_asset_id(id, name, type, status),
        department:department_id(id, name, code),
        creator:created_by(id, email, full_name),
        allocations:license_allocations(
          id, assigned_at, notes,
          asset:allocated_to_asset_id(id, name, type, status, location),
          user:allocated_to_user_id(id, email, full_name)
        )
      `)
      .eq('id', licenseId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    return data || null;
  }

  /**
   * Create a new software license
   */
  static async create(licenseData) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .table('software_licenses')
      .insert(licenseData)
      .select();

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  }

  /**
   * Update an existing software license
   */
  static async update(licenseId, updateData) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .table('software_licenses')
      .update(updateData)
      .eq('id', licenseId)
      .select();

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  }

  /**
   * Delete a software license
   */
  static async delete(licenseId) {
    const supabase = getSupabase();
    const { error } = await supabase
      .table('software_licenses')
      .delete()
      .eq('id', licenseId);

    if (error) throw error;
    return true;
  }

  /**
   * Get all allocations for a specific license
   */
  static async getAllocations(licenseId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .table('license_allocations')
      .select(`
        *,
        asset:allocated_to_asset_id(id, name, type, status, location),
        user:allocated_to_user_id(id, email, full_name)
      `)
      .eq('license_id', licenseId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Create seat allocation
   */
  static async createAllocation(allocationData) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .table('license_allocations')
      .insert(allocationData)
      .select();

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  }

  /**
   * Reclaim/delete seat allocation
   */
  static async deleteAllocation(allocationId) {
    const supabase = getSupabase();
    const { error } = await supabase
      .table('license_allocations')
      .delete()
      .eq('id', allocationId);

    if (error) throw error;
    return true;
  }

  /**
   * Invoke stored procedure for compliance summary
   */
  static async getComplianceSummary() {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase.rpc('get_license_compliance_summary');
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn(`⚠️ get_license_compliance_summary RPC error: ${err.message}`);
      return [];
    }
  }
}
