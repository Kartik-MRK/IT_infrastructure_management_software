import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createAccessToken, setMockUserProfile, resetSecurityMocks } from '../src/core/security.js';
import { setSupabaseClient, resetSupabaseClient } from '../src/core/database.js';

describe('Phase 4: Management Modules - Software Licenses & Compliance', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = createApp();
  });

  afterEach(() => {
    resetSecurityMocks();
    resetSupabaseClient();
  });

  describe('License Lifecycle & Metrics', () => {
    test('GET /api/licenses returns list of licenses with computed metrics (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const mockLicenses = [
        {
          id: 'lic-1',
          license_name: 'IntelliJ IDEA Ultimate',
          total_seats: 10,
          allocations: [{ id: 'alloc-1' }, { id: 'alloc-2' }],
          expiration_date: '2099-12-31',
        },
      ];

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockLicenses,
              error: null,
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/licenses')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.licenses).toHaveLength(1);
      const lic = res.body.licenses[0];
      expect(lic.allocated_seats).toBe(2);
      expect(lic.available_seats).toBe(8);
      expect(lic.utilization_percent).toBe(20.0);
      expect(lic.compliance_status).toBe('COMPLIANT');
    });

    test('POST /api/licenses creates license for software asset (201)', async () => {
      const adminId = 'admin-1';
      const token = createAccessToken(adminId);
      setMockUserProfile(async () => ({ id: adminId, role: 'it_admin' }));

      const payload = {
        software_asset_id: 'asset-sw-1',
        license_name: 'Microsoft 365 E5',
        license_type: 'subscription',
        total_seats: 50,
        cost_per_seat: 38.0,
      };

      const mockSupabase = {
        table: jest.fn().mockImplementation((tableName) => {
          if (tableName === 'assets') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'asset-sw-1', name: 'M365 Suite', type: 'software' },
                    error: null,
                  }),
                  is: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: { id: 'asset-sw-1', name: 'M365 Suite', type: 'software' },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (tableName === 'software_licenses') {
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockResolvedValue({
                  data: [{ id: 'lic-created', ...payload }],
                  error: null,
                }),
              }),
            };
          }
          return {};
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post('/api/licenses')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Software license created successfully');
      expect(res.body.license.id).toBe('lic-created');
    });

    test('POST /api/licenses rejects attaching to non-software asset (400)', async () => {
      const adminId = 'admin-1';
      const token = createAccessToken(adminId);
      setMockUserProfile(async () => ({ id: adminId, role: 'it_admin' }));

      const mockSupabase = {
        table: jest.fn().mockImplementation((tableName) => {
          if (tableName === 'assets') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'asset-hw-1', name: 'Dell Server', type: 'server' },
                    error: null,
                  }),
                  is: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: { id: 'asset-hw-1', name: 'Dell Server', type: 'server' },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post('/api/licenses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          software_asset_id: 'asset-hw-1',
          license_name: 'Invalid Hardware Link',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Licenses can only be attached to 'software' assets");
    });

    test('POST /api/licenses/:id/allocate allocates seat to asset (201)', async () => {
      const adminId = 'admin-1';
      const token = createAccessToken(adminId);
      setMockUserProfile(async () => ({ id: adminId, role: 'it_admin' }));

      const mockSupabase = {
        table: jest.fn().mockImplementation((tableName) => {
          if (tableName === 'software_licenses') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'lic-1', license_name: 'GitLab Ultimate', total_seats: 10 },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (tableName === 'assets') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'asset-ws-1', name: 'Dev Workstation', type: 'workstation' },
                    error: null,
                  }),
                  is: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: { id: 'asset-ws-1', name: 'Dev Workstation', type: 'workstation' },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (tableName === 'license_allocations') {
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockResolvedValue({
                  data: [{ id: 'alloc-1', license_id: 'lic-1', allocated_to_asset_id: 'asset-ws-1' }],
                  error: null,
                }),
              }),
            };
          }
          return {};
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post('/api/licenses/lic-1/allocate')
        .set('Authorization', `Bearer ${token}`)
        .send({ allocated_to_asset_id: 'asset-ws-1', notes: 'Lead Dev' });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('License seat allocated successfully');
      expect(res.body.allocation.id).toBe('alloc-1');
    });

    test('POST /api/licenses/:id/allocate detects duplicate assignment (409)', async () => {
      const adminId = 'admin-1';
      const token = createAccessToken(adminId);
      setMockUserProfile(async () => ({ id: adminId, role: 'it_admin' }));

      const mockSupabase = {
        table: jest.fn().mockImplementation((tableName) => {
          if (tableName === 'software_licenses') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'lic-1', license_name: 'GitLab Ultimate' },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (tableName === 'assets') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'asset-ws-1', name: 'Workstation 1' },
                    error: null,
                  }),
                  is: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: { id: 'asset-ws-1', name: 'Workstation 1' },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (tableName === 'license_allocations') {
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockRejectedValue(new Error('duplicate key value violates unique constraint "uq_license_asset_alloc"')),
              }),
            };
          }
          return {};
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post('/api/licenses/lic-1/allocate')
        .set('Authorization', `Bearer ${token}`)
        .send({ allocated_to_asset_id: 'asset-ws-1' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('This hardware asset already has a seat allocated');
    });

    test('DELETE /api/licenses/allocations/:id reclaims license seat (200)', async () => {
      const adminId = 'admin-1';
      const token = createAccessToken(adminId);
      setMockUserProfile(async () => ({ id: adminId, role: 'asset_custodian' }));

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .delete('/api/licenses/allocations/alloc-123')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('License seat reclaimed successfully');
    });

    test('GET /api/licenses/compliance-summary returns compliance metrics (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const mockRpcSummary = [
        {
          license_id: 'lic-1',
          license_name: 'VS Code Pro',
          total_seats: 10,
          allocated_seats: 5,
          compliance_status: 'COMPLIANT',
        },
        {
          license_id: 'lic-2',
          license_name: 'Overloaded App',
          total_seats: 5,
          allocated_seats: 6,
          compliance_status: 'OVER_ALLOCATED',
        },
      ];

      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ data: mockRpcSummary, error: null }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/licenses/compliance-summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.overview.total_licenses).toBe(2);
      expect(res.body.overview.total_seats).toBe(15);
      expect(res.body.overview.total_allocated).toBe(11);
      expect(res.body.compliance_breakdown.compliant).toBe(1);
      expect(res.body.compliance_breakdown.over_allocated).toBe(1);
    });
  });
});
