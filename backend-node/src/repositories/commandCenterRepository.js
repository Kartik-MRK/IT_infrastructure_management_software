/**
 * Repository Layer for Executive Analytics & SRE Command Center
 */

import { getSupabase } from '../core/database.js';

export class CommandCenterRepository {
  /**
   * Invoke PostgreSQL stored procedure aggregating health score, SRE reliability, financial TCO, and security posture
   */
  static async getCommandCenterMetrics() {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_executive_command_center_metrics', {});
    if (error) throw error;
    return data;
  }
}
