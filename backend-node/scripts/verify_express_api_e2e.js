import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getSupabase } from '../src/core/database.js';
import { createAccessToken } from '../src/core/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const results = [];

async function testEndpoint(name, method, url, sendData = null, headers = {}) {
  const start = Date.now();
  try {
    let req = request(app)[method.toLowerCase()](url);
    for (const [k, v] of Object.entries(headers)) {
      req = req.set(k, v);
    }
    if (sendData) {
      req = req.send(sendData);
    }
    const res = await req;
    const duration = Date.now() - start;

    if (res.status >= 200 && res.status < 300) {
      results.push({ name, method, url, status: 'PASSED', httpStatus: res.status, duration: `${duration}ms` });
      console.log(`✅ [${method} ${url}] (${res.status}, ${duration}ms) - ${name}`);
      return res.body;
    } else {
      const errMsg = `HTTP ${res.status}: ${JSON.stringify(res.body)}`;
      results.push({ name, method, url, status: 'FAILED', httpStatus: res.status, duration: `${duration}ms`, error: errMsg });
      console.error(`❌ [${method} ${url}] (${res.status}, ${duration}ms) - ${errMsg}`);
      return null;
    }
  } catch (err) {
    const duration = Date.now() - start;
    results.push({ name, method, url, status: 'FAILED', httpStatus: 500, duration: `${duration}ms`, error: err.message });
    console.error(`❌ [${method} ${url}] (${duration}ms) Exception:`, err.message);
    return null;
  }
}

let app;

async function main() {
  console.log('================================================================');
  console.log('🌐 ITIMS Express HTTP Server + Live Supabase Full E2E Verification');
  console.log('================================================================\n');

  // Initialize express app
  app = createApp();

  // Find an admin user in Supabase
  const supabase = getSupabase();
  const { data: profiles, error: profErr } = await supabase.table('profiles').select('id, email, role').limit(5);
  if (profErr || !profiles?.length) {
    throw new Error(`Failed to read admin profile: ${profErr?.message}`);
  }
  const admin = profiles.find((p) => p.role === 'admin' || p.role === 'it_admin') || profiles[0];
  console.log(`🔑 Discovered Auth Principal: ${admin.email} (Role: ${admin.role}, ID: ${admin.id})\n`);

  const token = createAccessToken(admin.id, { email: admin.email, role: admin.role });
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  let createdAssetId = null;
  let createdIncidentId = null;

  // 1. Health check
  await testEndpoint('Health Check Probe', 'GET', '/health');

  // 2. Assets: List
  await testEndpoint('List Assets via Express Router', 'GET', '/api/assets', null, authHeaders);

  // 3. Assets: Create
  const assetPayload = {
    name: 'EXPRESS_E2E_HTTP_VALIDATION_SERVER',
    type: 'infrastructure',
    status: 'active',
    location: 'Cloud Data Center Row 4',
    serial_number: `HTTP-E2E-${Date.now()}`,
    cost: 4800.0,
    salvage_value: 480.0,
    useful_life_years: 5,
    purchase_date: '2026-01-15',
    created_by: admin.id,
  };
  const createdAssetRes = await testEndpoint('Create Asset via HTTP POST', 'POST', '/api/assets', assetPayload, authHeaders);
  if (createdAssetRes && (createdAssetRes.id || createdAssetRes.asset?.id)) {
    createdAssetId = createdAssetRes.id || createdAssetRes.asset?.id;
  }

  // 4. Assets: Get single
  if (createdAssetId) {
    await testEndpoint('Get Asset Detail via HTTP GET', 'GET', `/api/assets/${createdAssetId}`, null, authHeaders);

    // 5. Assets: Update
    await testEndpoint('Update Asset Status via HTTP PUT', 'PUT', `/api/assets/${createdAssetId}`, {
      status: 'maintenance',
      location: 'Cloud Data Center Row 4 (Under Service)',
    }, authHeaders);
  }

  // 6. Incidents: Create
  if (createdAssetId) {
    const incPayload = {
      title: 'HTTP Layer E2E Integration Probe Incident',
      description: 'Verifying end-to-end route to Supabase fulfillment across all controllers.',
      severity: 'medium',
      status: 'open',
      priority: 3,
      asset_id: createdAssetId,
      reported_by: admin.id,
    };
    const createdIncRes = await testEndpoint('Create Incident via HTTP POST', 'POST', '/api/incidents', incPayload, authHeaders);
    if (createdIncRes && (createdIncRes.id || createdIncRes.incident?.id)) {
      createdIncidentId = createdIncRes.id || createdIncRes.incident?.id;
    }
  }

  // 7. Incidents: List
  await testEndpoint('List Incidents via HTTP GET', 'GET', '/api/incidents', null, authHeaders);

  // 8. Incidents: Update / Resolve
  if (createdIncidentId) {
    await testEndpoint('Resolve Incident via HTTP PUT', 'PUT', `/api/incidents/${createdIncidentId}`, {
      status: 'resolved',
      resolution_notes: 'Successfully resolved and confirmed by end-to-end integration probe.',
    }, authHeaders);
  }

  // 9. Licenses & Compliance
  await testEndpoint('List Licenses via HTTP GET', 'GET', '/api/licenses', null, authHeaders);
  await testEndpoint('Get License Compliance Summary (RPC)', 'GET', '/api/licenses/compliance-summary', null, authHeaders);

  // 10. Financials Summary & Forecast
  await testEndpoint('Get Executive Financial Summary (RPC)', 'GET', '/api/financials/executive-summary', null, authHeaders);
  await testEndpoint('Get Depreciation 5-Year Forecast', 'GET', '/api/financials/depreciation-forecast', null, authHeaders);

  // 11. SLA Summary
  await testEndpoint('Get SLA Performance Scorecard (RPC)', 'GET', '/api/sla/summary', null, authHeaders);

  // 12. CVE Vulnerabilities Summary
  await testEndpoint('Get Vulnerability Posture Summary (RPC)', 'GET', '/api/vulnerabilities/summary', null, authHeaders);

  // 13. Cryptographic Audit Certificate
  await testEndpoint('Generate Audit Compliance Certificate (RPC)', 'GET', '/api/audit-ledger/compliance-certificate', null, authHeaders);

  // 14. Executive Command Center Metrics
  await testEndpoint('Get SRE Executive Command Center Metrics (RPC)', 'GET', '/api/command-center/metrics', null, authHeaders);

  // 15. Teardown / Cleanup
  if (createdIncidentId) {
    await testEndpoint('Delete Test Incident via HTTP DELETE', 'DELETE', `/api/incidents/${createdIncidentId}`, null, authHeaders);
  }
  if (createdAssetId) {
    await testEndpoint('Delete Test Asset via HTTP DELETE', 'DELETE', `/api/assets/${createdAssetId}`, null, authHeaders);
  }

  // Summary
  console.log('\n================================================================');
  console.log('📊 END-TO-END EXPRESS HTTP + SUPABASE REPORT');
  console.log('================================================================');
  const passed = results.filter((r) => r.status === 'PASSED').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;

  console.table(results.map((r) => ({
    Endpoint: `${r.method} ${r.url}`,
    Feature: r.name,
    HTTP: r.httpStatus,
    Status: r.status,
    Duration: r.duration,
  })));

  console.log(`\n🏁 Total API Tests: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  if (failed === 0) {
    console.log('🎉 100% OF EXPRESS API ROUTES ARE FULLY OPERATIONAL AND FULFILLED BY SUPABASE!');
  } else {
    console.error('⚠️ Some routes failed. Review log above.');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal E2E failure:', err);
  process.exit(1);
});
