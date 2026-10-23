import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createAccessToken, setMockUserProfile, resetSecurityMocks } from '../src/core/security.js';
import { setSupabaseClient, resetSupabaseClient } from '../src/core/database.js';

describe('Phase 5: Advanced Systems - Vulnerability Scans & Remediation (CVEs)', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = createApp();
  });

  afterEach(() => {
    resetSecurityMocks();
    resetSupabaseClient();
  });

  describe('CVE Asset Scanning & Threat Posture', () => {
    test('POST /api/assets/:id/scan-vulnerabilities invokes stored procedure (200)', async () => {
      const token = createAccessToken('user-sec');
      setMockUserProfile(async () => ({ id: 'user-sec', role: 'admin' }));

      const mockScanOutput = {
        asset_id: 'asset-srv-1',
        scanned_at: '2026-10-23T10:00:00Z',
        vulnerabilities_found: 2,
        critical_count: 1,
        high_count: 1,
      };

      const mockSupabase = {
        rpc: jest.fn().mockImplementation((fnName, params) => {
          if (fnName === 'scan_asset_for_vulnerabilities') {
            return Promise.resolve({ data: mockScanOutput, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post('/api/assets/asset-srv-1/scan-vulnerabilities')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Vulnerability scan completed');
      expect(res.body.scan_result.vulnerabilities_found).toBe(2);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('scan_asset_for_vulnerabilities', {
        p_asset_id: 'asset-srv-1',
      });
    });

    test('POST /api/assets/:id/scan-vulnerabilities returns 401 if unauthenticated', async () => {
      const res = await request(app).post('/api/assets/asset-srv-1/scan-vulnerabilities');
      expect(res.status).toBe(401);
    });

    test('GET /api/assets/:id/vulnerabilities lists findings on asset (200)', async () => {
      const token = createAccessToken('user-sec');
      setMockUserProfile(async () => ({ id: 'user-sec', role: 'security_auditor' }));

      const mockFindings = [
        {
          id: 'vuln-1',
          asset_id: 'asset-srv-1',
          cve_id: 'CVE-2024-3094',
          status: 'open',
          cve: {
            cve_id: 'CVE-2024-3094',
            severity: 'critical',
            cvss_score: 10.0,
            summary: 'XZ Utils Backdoor',
          },
        },
      ];

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: mockFindings, error: null }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/assets/asset-srv-1/vulnerabilities')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.vulnerabilities[0].cve_id).toBe('CVE-2024-3094');
    });

    test('POST /api/vulnerabilities/:id/create-incident creates 1-click remediation ticket (201)', async () => {
      const token = createAccessToken('sec-lead');
      setMockUserProfile(async () => ({ id: 'sec-lead', role: 'admin' }));

      const mockIncidentOutput = {
        incident_id: 'inc-remed-101',
        title: 'Security Remediation: CVE-2024-3094',
        severity: 'critical',
        status: 'open',
      };

      const mockSupabase = {
        rpc: jest.fn().mockImplementation((fnName, params) => {
          if (fnName === 'create_remediation_incident_from_cve') {
            return Promise.resolve({ data: mockIncidentOutput, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post('/api/vulnerabilities/vuln-1/create-incident')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body.incident_id).toBe('inc-remed-101');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_remediation_incident_from_cve', {
        p_vuln_id: 'vuln-1',
        p_reporter_id: 'sec-lead',
      });
    });

    test('PUT /api/vulnerabilities/:id/status updates status (200)', async () => {
      const token = createAccessToken('sec-lead');
      setMockUserProfile(async () => ({ id: 'sec-lead', role: 'admin' }));

      const updatedRecord = {
        id: 'vuln-1',
        status: 'in_remediation',
      };

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({ data: [updatedRecord], error: null }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .put('/api/vulnerabilities/vuln-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'in_remediation' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Status updated successfully');
      expect(res.body.vulnerability.status).toBe('in_remediation');
    });

    test('PUT /api/vulnerabilities/:id/status rejects invalid status (400)', async () => {
      const token = createAccessToken('sec-lead');
      setMockUserProfile(async () => ({ id: 'sec-lead', role: 'admin' }));

      const res = await request(app)
        .put('/api/vulnerabilities/vuln-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'not_a_valid_status' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('status');
    });

    test('GET /api/vulnerabilities/summary returns scorecard (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'operator' }));

      const mockSummary = {
        total_open_vulnerabilities: 12,
        critical_count: 2,
        high_count: 4,
        medium_count: 5,
        low_count: 1,
        mean_time_to_remediate_days: 3.5,
      };

      const mockSupabase = {
        rpc: jest.fn().mockImplementation((fnName) => {
          if (fnName === 'get_system_vulnerability_summary') {
            return Promise.resolve({ data: mockSummary, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/vulnerabilities/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.summary.total_open_vulnerabilities).toBe(12);
      expect(res.body.summary.critical_count).toBe(2);
    });

    test('GET /api/v1/vulnerabilities supports dual mount and filters (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const mockData = [
        {
          id: 'vuln-1',
          status: 'open',
          cve: { severity: 'critical' },
        },
        {
          id: 'vuln-2',
          status: 'open',
          cve: { severity: 'medium' },
        },
      ];

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mockData, error: null }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/v1/vulnerabilities?status=open&severity=critical')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.vulnerabilities).toHaveLength(1);
      expect(res.body.vulnerabilities[0].id).toBe('vuln-1');
    });
  });
});
