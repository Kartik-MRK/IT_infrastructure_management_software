import { getSupabase } from '../core/database.js';

export class UserRepository {
  /**
   * Fetch all profiles with joined department
   */
  static async getAll() {
    const supabase = getSupabase();
    return await supabase
      .table('profiles')
      .select('*, department:department_id(id, name, code)')
      .order('created_at', { ascending: false });
  }

  /**
   * Fetch single user profile by id
   */
  static async getById(userId) {
    const supabase = getSupabase();
    return await supabase
      .table('profiles')
      .select('*, department:department_id(id, name, code)')
      .eq('id', userId)
      .single();
  }

  /**
   * Update profile by id
   */
  static async update(userId, updateData) {
    const supabase = getSupabase();
    return await supabase
      .table('profiles')
      .update(updateData)
      .eq('id', userId)
      .select();
  }

  /**
   * Delete profile by id
   */
  static async delete(userId) {
    const supabase = getSupabase();
    return await supabase
      .table('profiles')
      .delete()
      .eq('id', userId);
  }

  /**
   * Fetch available roles catalog
   */
  static async getRoles() {
    const supabase = getSupabase();
    return await supabase
      .table('roles')
      .select('id, name, description, is_system_role, role_permissions(permission_id)')
      .order('name');
  }

  /**
   * Fetch organizational departments
   */
  static async getDepartments() {
    const supabase = getSupabase();
    return await supabase
      .table('departments')
      .select('*')
      .order('name');
  }

  /**
   * Fetch audit logs for security/compliance
   */
  static async getAuditLogs({ limit = 50, tableName = null, recordId = null } = {}) {
    const supabase = getSupabase();
    let query = supabase
      .table('audit_logs')
      .select('id, table_name, record_id, action, old_values, new_values, performed_at, performer:performed_by(email, full_name)');

    if (tableName) {
      query = query.eq('table_name', tableName);
    }
    if (recordId) {
      query = query.eq('record_id', recordId);
    }

    return await query
      .order('performed_at', { ascending: false })
      .limit(limit);
  }
}

export default UserRepository;
