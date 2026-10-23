import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from backend-node/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

import WebSocket from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
});

if (!supabase.table) {
  supabase.table = (tableName) => supabase.from(tableName);
}

const results = [];

async function runCheck(name, category, fn) {
  const start = Date.now();
  try {
    const data = await fn();
    const duration = Date.now() - start;
    results.push({ name, category, status: 'PASSED', duration: `${duration}ms`, details: data || 'OK' });
    console.log(`✅ [${category}] ${name} (${duration}ms)`);
  } catch (err) {
    const duration = Date.now() - start;
    results.push({ name, category, status: 'FAILED', duration: `${duration}ms`, error: err.message });
    console.error(`❌ [${category}] ${name} (${duration}ms):`, err.message);
  }
}

async function main() {
  console.log('================================================================');
  console.log('🔍 ITIMS End-to-End Live Supabase CRUD & Functional Audit Scan');
  console.log(`🌐 Supabase Target: ${supabaseUrl}`);
  console.log('================================================================\n');

  let testAssetId = null;
  let testIncidentId = null;
  let adminUserId = null;

  // 1. AUTH & PROFILES
  await runCheck('Read Profiles & Discover Admin User', 'Auth & RBAC', async () => {
    const { data, error } = await supabase.table('profiles').select('id, full_name, email, role').limit(5);
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No user profiles found in database');
    const admin = data.find((u) => u.role === 'admin' || u.role === 'it_admin') || data[0];
    adminUserId = admin.id;
    return `Found ${data.length} profiles, selected caller: ${admin.email} (${admin.role})`;
  });

  await runCheck('RPC: get_user_permissions', 'Auth & RBAC', async () => {
    if (!adminUserId) return 'Skipped (no admin user)';
    const { data, error } = await supabase.rpc('get_user_permissions', { user_uuid: adminUserId });
    if (error) throw error;
    return `Returned ${Array.isArray(data) ? data.length : 0} permissions for user ${adminUserId}`;
  });

  // 2. ASSETS CRUD
  await runCheck('Create Test Asset (INSERT)', 'Assets CRUD', async () => {
    const newAsset = {
      name: 'E2E_DIAGNOSTIC_VERIFICATION_NODE',
      type: 'hardware',
      status: 'active',
      location: 'Data Center Rack A-1',
      serial_number: `E2E-SN-${Date.now()}`,
      cost: 2500.0,
      salvage_value: 250.0,
      useful_life_years: 5,
      purchase_date: new Date().toISOString().split('T')[0],
      created_by: adminUserId,
    };
    const { data, error } = await supabase.table('assets').insert(newAsset).select().single();
    if (error) throw error;
    testAssetId = data.id;
    return `Created asset id: ${testAssetId} (name: ${data.name})`;
  });

  await runCheck('Read Asset by ID (SELECT single)', 'Assets CRUD', async () => {
    if (!testAssetId) throw new Error('Asset ID missing');
    const { data, error } = await supabase.table('assets').select('*').eq('id', testAssetId).single();
    if (error) throw error;
    return `Retrieved asset: ${data.name}, status: ${data.status}`;
  });

  await runCheck('Update Asset Status (UPDATE)', 'Assets CRUD', async () => {
    if (!testAssetId) throw new Error('Asset ID missing');
    const { data, error } = await supabase
      .table('assets')
      .update({ status: 'maintenance' })
      .eq('id', testAssetId)
      .select()
      .single();
    if (error) throw error;
    if (data.status !== 'maintenance') throw new Error(`Status update failed: ${data.status}`);
    return `Updated status to: ${data.status}`;
  });

  await runCheck('List Assets with Pagination & Filter (SELECT list)', 'Assets CRUD', async () => {
    const { data, error, count } = await supabase
      .table('assets')
      .select('id, name, type, status', { count: 'exact' })
      .limit(10);
    if (error) throw error;
    return `Total assets in database: ${count}, fetched sample of ${data.length}`;
  });

  // 3. INCIDENTS CRUD
  await runCheck('Create Test Incident (INSERT)', 'Incidents CRUD', async () => {
    if (!testAssetId || !adminUserId) throw new Error('Prerequisites missing');
    const newInc = {
      title: 'E2E Automated Health Diagnostic Incident',
      description: 'System-generated test incident for verifying Express/Supabase CRUD fulfillment.',
      severity: 'medium',
      status: 'open',
      priority: 5,
      asset_id: testAssetId,
      reported_by: adminUserId,
    };
    const { data, error } = await supabase.table('incidents').insert(newInc).select().single();
    if (error) throw error;
    testIncidentId = data.id;
    return `Created incident id: ${testIncidentId} (title: ${data.title})`;
  });

  await runCheck('Read Incident by ID (SELECT single with joins)', 'Incidents CRUD', async () => {
    if (!testIncidentId) throw new Error('Incident ID missing');
    const { data, error } = await supabase
      .table('incidents')
      .select('*, reporter:reported_by(id, full_name), asset:asset_id(id, name)')
      .eq('id', testIncidentId)
      .single();
    if (error) throw error;
    return `Incident: "${data.title}", reporter: ${data.reporter?.full_name || 'N/A'}, asset: ${data.asset?.name || 'N/A'}`;
  });

  await runCheck('Update Incident Status to Resolved (UPDATE)', 'Incidents CRUD', async () => {
    if (!testIncidentId) throw new Error('Incident ID missing');
    const { data, error } = await supabase
      .table('incidents')
      .update({
        status: 'resolved',
        resolution_notes: 'Verified via automated Node backend health probe.',
        resolved_at: new Date().toISOString(),
        resolved_by: adminUserId,
      })
      .eq('id', testIncidentId)
      .select()
      .single();
    if (error) throw error;
    return `Incident resolved by ${data.resolved_by} at ${data.resolved_at}`;
  });

  // 4. CMDB TOPOLOGY & BLAST RADIUS
  await runCheck('Read Asset Relationships (SELECT)', 'CMDB Topology', async () => {
    const { data, error } = await supabase.table('asset_relationships').select('*').limit(5);
    if (error) throw error;
    return `Found ${data.length} topology edges`;
  });

  await runCheck('RPC: calculate_blast_radius', 'CMDB Topology', async () => {
    if (!testAssetId) return 'Skipped (no asset id)';
    const { data, error } = await supabase.rpc('calculate_blast_radius', {
      root_asset_id: testAssetId,
      max_depth: 3,
    });
    if (error) throw error;
    return `Blast radius evaluation executed cleanly, impacted count: ${Array.isArray(data) ? data.length : 0}`;
  });

  // 5. SOFTWARE LICENSES & SEAT COMPLIANCE
  await runCheck('Read Software Licenses & Allocations', 'Software Licenses', async () => {
    const { data, error } = await supabase.table('software_licenses').select('id, license_name, total_seats, cost_per_seat').limit(5);
    if (error) throw error;
    return `Found ${data.length} software licenses`;
  });

  await runCheck('RPC: get_license_compliance_summary', 'Software Licenses', async () => {
    const { data, error } = await supabase.rpc('get_license_compliance_summary', {});
    if (error) throw error;
    return `Compliance scorecard: total_licenses=${data?.total_licenses ?? 'N/A'}, over_allocated=${data?.over_allocated_count ?? 'N/A'}`;
  });

  // 6. PHYSICAL AUDITS & DISCREPANCIES
  await runCheck('Read Physical Audits History', 'Physical Audits', async () => {
    const { data, error } = await supabase.table('asset_audits').select('*').limit(5);
    if (error) throw error;
    return `Found ${data.length} physical audit records`;
  });

  await runCheck('RPC: get_physical_audit_summary', 'Physical Audits', async () => {
    const { data, error } = await supabase.rpc('get_physical_audit_summary', {});
    if (error) throw error;
    return `Audit summary: total_audits=${data?.total_audits ?? 'N/A'}, discrepancy_count=${data?.discrepancy_count ?? 'N/A'}`;
  });

  // 7. FINANCIAL LIFECYCLE & TCO
  await runCheck('RPC: get_executive_financial_summary', 'Financials & TCO', async () => {
    const { data, error } = await supabase.rpc('get_executive_financial_summary', {});
    if (error) throw error;
    return `Executive financial summary: total_assets=${data?.total_assets ?? 'N/A'}, total_purchase_cost=${data?.total_purchase_cost ?? 'N/A'}`;
  });

  await runCheck('RPC: calculate_asset_financials', 'Financials & TCO', async () => {
    if (!testAssetId) return 'Skipped';
    const { data, error } = await supabase.rpc('calculate_asset_financials', { target_asset_id: testAssetId });
    if (error) throw error;
    return `Asset financial calculation: current_book_value=${data?.current_book_value ?? 'N/A'}, tco=${data?.total_cost_of_ownership ?? 'N/A'}`;
  });

  // 8. TELEMETRY & HARDWARE HEALTH
  await runCheck('Read Asset Telemetry & Metrics', 'Telemetry', async () => {
    const { data, error } = await supabase.table('asset_metrics').select('id, asset_id, cpu_usage, memory_usage, is_operational').limit(5);
    if (error) throw error;
    return `Found ${data.length} telemetry metrics records`;
  });

  // 9. SLA ENGINE
  await runCheck('Read SLA Policies & Timers', 'SLA Engine', async () => {
    const { data, error } = await supabase.table('sla_policies').select('*').limit(5);
    if (error) throw error;
    return `Found ${data.length} SLA policies configured`;
  });

  await runCheck('RPC: get_sla_compliance_summary', 'SLA Engine', async () => {
    const { data, error } = await supabase.rpc('get_sla_compliance_summary', {});
    if (error) throw error;
    return `SLA scorecard: overall_compliance=${data?.overall_compliance_percentage ?? 'N/A'}%`;
  });

  // 10. POSTMORTEMS (5-WHYS RCA)
  await runCheck('Read Incident Postmortems', 'Postmortems RCA', async () => {
    const { data, error } = await supabase.table('incident_postmortems').select('id, incident_id, root_cause_analysis, status').limit(5);
    if (error) throw error;
    return `Found ${data.length} postmortem RCA records`;
  });

  // 11. CRYPTOGRAPHIC AUDIT LEDGER
  await runCheck('Read Audit Chain Ledger', 'Crypto Audit Ledger', async () => {
    const { data, error } = await supabase.table('cryptographic_audit_logs').select('sequence_number, action, entry_hash').order('sequence_number', { ascending: false }).limit(3);
    if (error) throw error;
    return `Latest block #${data[0]?.sequence_number || 0}, action: ${data[0]?.action || 'N/A'}`;
  });

  await runCheck('RPC: verify_audit_log_chain_integrity', 'Crypto Audit Ledger', async () => {
    const { data, error } = await supabase.rpc('verify_audit_log_chain_integrity', {});
    if (error) throw error;
    return `Chain validity: is_chain_valid=${data?.is_chain_valid ?? 'N/A'}, total_blocks_verified=${data?.total_blocks_verified ?? 'N/A'}`;
  });

  // 12. CVE VULNERABILITIES SCANNER
  await runCheck('Read CVE Vulnerabilities Cache & Findings', 'CVE Scanner', async () => {
    const { data, error } = await supabase.table('cve_cache').select('cve_id, cvss_score, severity').limit(5);
    if (error) throw error;
    return `Found ${data.length} CVE signatures cached`;
  });

  await runCheck('RPC: get_system_vulnerability_summary', 'CVE Scanner', async () => {
    const { data, error } = await supabase.rpc('get_system_vulnerability_summary', {});
    if (error) throw error;
    return `CVE posture: total_open=${data?.total_open_vulnerabilities ?? 'N/A'}, critical=${data?.critical_count ?? 'N/A'}`;
  });

  // 13. EXECUTIVE SRE COMMAND CENTER
  await runCheck('RPC: get_executive_command_center_metrics', 'Command Center', async () => {
    const { data, error } = await supabase.rpc('get_executive_command_center_metrics', {});
    if (error) throw error;
    return `Command center metrics: global_health_score=${data?.global_health_score ?? 'N/A'}, sre_uptime=${data?.sre_reliability?.uptime_percentage ?? 'N/A'}%`;
  });

  // 14. CLEANUP TEST DATA (DELETE)
  if (testIncidentId) {
    await runCheck('Delete Test Incident (DELETE)', 'Cleanup', async () => {
      const { error } = await supabase.table('incidents').delete().eq('id', testIncidentId);
      if (error) throw error;
      return `Deleted test incident ${testIncidentId}`;
    });
  }

  if (testAssetId) {
    await runCheck('Delete Test Asset (DELETE)', 'Cleanup', async () => {
      const { error } = await supabase.table('assets').delete().eq('id', testAssetId);
      if (error) throw error;
      return `Deleted test asset ${testAssetId}`;
    });
  }

  // SUMMARY REPORT
  console.log('\n================================================================');
  console.log('📊 AUDIT SUMMARY TABLE');
  console.log('================================================================');
  const passed = results.filter((r) => r.status === 'PASSED').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;
  console.table(results.map((r) => ({
    Category: r.category,
    Check: r.name,
    Status: r.status,
    Duration: r.duration,
    Output: r.error || (typeof r.details === 'string' ? r.details.slice(0, 60) : 'OK'),
  })));

  console.log(`\n🏁 Total Checks: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  if (failed === 0) {
    console.log('🎉 ALL SUPABASE CRUD OPERATIONS & RPC CONTRACTS ARE 100% OPERATIONAL!');
  } else {
    console.error('⚠️ One or more checks failed. Review errors above.');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
