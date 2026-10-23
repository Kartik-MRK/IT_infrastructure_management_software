import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createAccessToken, setMockUserProfile, resetSecurityMocks } from '../src/core/security.js';
import { setSupabaseClient, resetSupabaseClient } from '../src/core/database.js';

describe('Phase 4: Management Modules - Physical Auditing & Barcode Scans', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = createApp();
  });

  afterEach(() => {
    resetSecurityMocks();
    resetSupabaseClient();
  });

  describe('Physical Audit Workflows', () => {
    test('POST /api/assets/:id/audits records successful audit verification (201)', async () => {
      const auditorId = 'auditor-1';
      const token = createAccessToken(auditorId);
      setMockUserProfile(async () => ({ id: auditorId, role: 'technician' }));

      const assetId = 'asset-srv-1';
      const mockSupabase = {
        table: jest.fn().mockImplementation((tableName) => {
          if (tableName === 'assets') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: assetId, name: 'Main DB', location: 'Rack A-01', status: 'active' },
                    error: null,
                  }),
                  is: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: { id: assetId, name: 'Main DB', location: 'Rack A-01', status: 'active' },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
        rpc: jest.fn().mockImplementation((fnName, params) => {
          if (fnName === 'record_asset_physical_audit') {
            return Promise.resolve({
              data: {
                id: 'audit-log-1',
                asset_id: assetId,
                auditor_id: auditorId,
                location_verified: true,
                status_verified: true,
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post(`/api/assets/${assetId}/audits`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          physical_condition: 'excellent',
          scan_method: 'camera_qr',
          observed_location: 'Rack A-01',
          observed_status: 'active',
          notes: 'Routine sweep',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Physical audit recorded successfully');
      expect(res.body.audit.id).toBe('audit-log-1');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('record_asset_physical_audit', expect.objectContaining({
        p_location_verified: true,
        p_status_verified: true,
      }));
    });

    test('POST /api/assets/:id/audits flags location discrepancy when observed location differs', async () => {
      const auditorId = 'auditor-1';
      const token = createAccessToken(auditorId);
      setMockUserProfile(async () => ({ id: auditorId, role: 'technician' }));

      const assetId = 'asset-srv-1';
      let rpcCallParams = null;

      const mockSupabase = {
        table: jest.fn().mockImplementation((tableName) => {
          if (tableName === 'assets') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: assetId, name: 'Main DB', location: 'Server Room 1', status: 'active' },
                    error: null,
                  }),
                  is: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: { id: assetId, name: 'Main DB', location: 'Server Room 1', status: 'active' },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
        rpc: jest.fn().mockImplementation((fnName, params) => {
          rpcCallParams = params;
          return Promise.resolve({
            data: { id: 'audit-flagged', location_verified: params.p_location_verified },
            error: null,
          });
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post(`/api/assets/${assetId}/audits`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          physical_condition: 'fair',
          observed_location: 'Server Room 2 (Moved without ticket)',
        });

      expect(res.status).toBe(201);
      expect(rpcCallParams.p_location_verified).toBe(false);
    });

    test('POST /api/assets/:id/audits returns 404 for unknown asset', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'admin' }));

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
              is: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
              }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post('/api/assets/nonexistent/audits')
        .set('Authorization', `Bearer ${token}`)
        .send({ physical_condition: 'good' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    test('GET /api/assets/:id/audits returns historical audit timeline (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const assetId = 'asset-1';
      const mockAudits = [
        { id: 'aud-1', audited_at: '2026-01-01T00:00:00Z', physical_condition: 'good' },
      ];

      const mockSupabase = {
        table: jest.fn().mockImplementation((tableName) => {
          if (tableName === 'assets') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: { id: assetId, name: 'Server' }, error: null }),
                  is: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: { id: assetId, name: 'Server' }, error: null }),
                  }),
                }),
              }),
            };
          }
          if (tableName === 'asset_audits') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({ data: mockAudits, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get(`/api/assets/${assetId}/audits`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.asset_id).toBe(assetId);
      expect(res.body.audits).toHaveLength(1);
    });

    test('GET /api/audits/summary returns organization-wide metrics (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const mockSummary = {
        total_assets: 120,
        audited_last_90_days: 95,
        audit_compliance_percent: 79.17,
        verified_count: 90,
        flagged_count: 5,
        missing_count: 0,
        pending_count: 25,
      };

      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ data: [mockSummary], error: null }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/audits/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total_assets).toBe(120);
      expect(res.body.audit_compliance_percent).toBe(79.17);
    });
  });
});
