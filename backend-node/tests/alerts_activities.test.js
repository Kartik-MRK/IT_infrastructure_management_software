import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createAccessToken, setMockUserProfile, resetSecurityMocks } from '../src/core/security.js';
import { setSupabaseClient, resetSupabaseClient } from '../src/core/database.js';

describe('Phase 5: Advanced Systems - Alerts, Activity Feed & Executive Command Center', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = createApp();
  });

  afterEach(() => {
    resetSecurityMocks();
    resetSupabaseClient();
  });

  describe('System Health Alerts Aggregator', () => {
    test('GET /api/alerts returns aggregated critical and warning alerts (200)', async () => {
      const token = createAccessToken('op-1');
      setMockUserProfile(async () => ({ id: 'op-1', role: 'operator' }));

      const mockCriticalMetrics = [
        {
          id: 'crit-1',
          asset_id: 'srv-prod-1',
          cpu_usage: 95.5,
          memory_usage: 92.0,
          temperature: 80.0,
          disk_usage: 85.0,
          last_updated: '2026-10-23T10:00:00Z',
          asset: {
            id: 'srv-prod-1',
            name: 'Production DB Primary',
            type: 'hardware',
          },
        },
      ];

      const mockWarningMetrics = [
        {
          id: 'warn-1',
          asset_id: 'srv-redis-1',
          last_updated: '2026-10-23T10:05:00Z',
          asset: {
            id: 'srv-redis-1',
            name: 'Redis Cluster Node',
            type: 'hardware',
          },
        },
      ];

      const mockProblematicAssets = [
        {
          id: 'asset-dmg-1',
          name: 'Core Switch Rack 2',
          type: 'network',
          status: 'maintenance',
          updated_at: '2026-10-23T09:00:00Z',
        },
      ];

      const mockSupabase = {
        table: jest.fn().mockImplementation((tableName) => {
          if (tableName === 'asset_metrics') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockImplementation((limitVal) => {
                      if (limitVal === 10) return Promise.resolve({ data: mockCriticalMetrics, error: null });
                      return Promise.resolve({ data: mockWarningMetrics, error: null });
                    }),
                  }),
                }),
              }),
            };
          }
          if (tableName === 'assets') {
            return {
              select: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({ data: mockProblematicAssets, error: null }),
              }),
            };
          }
          return {
            select: jest.fn().mockReturnValue({}),
          };
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.alerts.length).toBeGreaterThanOrEqual(3);
      expect(res.body.alerts[0].severity).toBe('critical');
      expect(res.body.alerts[0].message).toContain('CPU: 95.5%');
    });

    test('GET /api/alerts formats peripheral, network, and software alerts appropriately', async () => {
      const token = createAccessToken('admin-1');
      setMockUserProfile(async () => ({ id: 'admin-1', role: 'admin' }));

      const mockMetrics = [
        {
          id: 'p-1',
          asset_id: 'ast-p-1',
          connection_status: 'disconnected',
          print_status: 'paper_jam',
          peripheral_error: 'Tray 2 Empty',
          last_updated: '2026-10-23T10:00:00Z',
          asset: { id: 'ast-p-1', name: 'Floor 3 Printer', type: 'peripherals' },
        },
        {
          id: 'n-1',
          asset_id: 'ast-n-1',
          packet_loss_percent: 12.5,
          last_updated: '2026-10-23T10:01:00Z',
          asset: { id: 'ast-n-1', name: 'WAN Gateway', type: 'network' },
        },
        {
          id: 's-1',
          asset_id: 'ast-s-1',
          last_error: 'License token revoked',
          last_updated: '2026-10-23T10:02:00Z',
          asset: { id: 'ast-s-1', name: 'AutoCAD Suite', type: 'software' },
        },
      ];

      const mockSupabase = {
        table: jest.fn().mockImplementation((tableName) => {
          if (tableName === 'asset_metrics') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockImplementation((limitVal) => {
                      if (limitVal === 10) return Promise.resolve({ data: mockMetrics, error: null });
                      return Promise.resolve({ data: [], error: null });
                    }),
                  }),
                }),
              }),
            };
          }
          if (tableName === 'assets') {
            return {
              select: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            };
          }
          return {};
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.alerts).toHaveLength(3);
      expect(res.body.alerts[0].message).toContain('Device Disconnected');
      expect(res.body.alerts[0].message).toContain('Paper Jam');
      expect(res.body.alerts[1].message).toContain('High packet loss: 12.50%');
      expect(res.body.alerts[2].message).toContain('Software not operational: License token revoked');
    });

    test('GET /api/alerts rejects viewer with 403 Forbidden', async () => {
      const token = createAccessToken('viewer-1');
      setMockUserProfile(async () => ({ id: 'viewer-1', role: 'viewer' }));

      const res = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Live Activity Feed', () => {
    test('GET /api/activities aggregates incidents and assets stream (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const mockRecentIncidents = [
        {
          id: 'inc-99',
          title: 'Database connection pool exhausted',
          severity: 'critical',
          status: 'open',
          created_at: '2026-10-23T10:30:00Z',
          reporter: { full_name: 'Alice Dev' },
          asset: { name: 'DB-Cluster' },
        },
      ];

      const mockRecentAssets = [
        {
          id: 'ast-88',
          name: 'Edge Router NYC',
          type: 'network',
          status: 'active',
          created_at: '2026-10-23T10:15:00Z',
          creator: { full_name: 'Bob Admin' },
        },
      ];

      const mockSupabase = {
        table: jest.fn().mockImplementation((tableName) => {
          if (tableName === 'incidents') {
            return {
              select: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({ data: mockRecentIncidents, error: null }),
                }),
              }),
            };
          }
          if (tableName === 'assets') {
            return {
              select: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({ data: mockRecentAssets, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/activities')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.activities).toHaveLength(2);
      expect(res.body.activities[0].type).toBe('incident');
      expect(res.body.activities[1].type).toBe('asset');
    });

    test('GET /api/activities returns 401 when unauthorized', async () => {
      const res = await request(app).get('/api/activities');
      expect(res.status).toBe(401);
    });
  });

  describe('Executive SRE Command Center Metrics', () => {
    test('GET /api/command-center/metrics returns unified metrics (200)', async () => {
      const token = createAccessToken('exec-1');
      setMockUserProfile(async () => ({ id: 'exec-1', role: 'admin' }));

      const mockMetrics = {
        global_health_score: 98.4,
        sre_reliability: {
          uptime_percentage: 99.98,
          open_p1_incidents: 0,
          mean_time_to_detect_minutes: 4.2,
          mean_time_to_resolve_hours: 1.1,
        },
        financial_tco: {
          total_asset_purchase_cost: 1450000.0,
          current_depreciated_book_value: 820000.0,
          unallocated_licenses_monthly_waste: 3200.0,
        },
        security_posture: {
          cve_open_vulnerabilities: 3,
          cryptographic_chain_status: 'HEALTHY',
          failed_audits_last_30d: 0,
        },
      };

      const mockSupabase = {
        rpc: jest.fn().mockImplementation((fnName) => {
          if (fnName === 'get_executive_command_center_metrics') {
            return Promise.resolve({ data: mockMetrics, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/command-center/metrics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.command_center.global_health_score).toBe(98.4);
      expect(res.body.command_center.security_posture.cryptographic_chain_status).toBe('HEALTHY');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_executive_command_center_metrics', {});
    });

    test('GET /api/v1/command-center/metrics dual mount works (200)', async () => {
      const token = createAccessToken('exec-1');
      setMockUserProfile(async () => ({ id: 'exec-1', role: 'admin' }));

      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ data: { status: 'healthy' }, error: null }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/v1/command-center/metrics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.command_center.status).toBe('healthy');
    });
  });
});
