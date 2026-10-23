import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createAccessToken, setMockUserProfile, resetSecurityMocks } from '../src/core/security.js';
import { setSupabaseClient, resetSupabaseClient } from '../src/core/database.js';

describe('Phase 5: Advanced Systems - Telemetry & Anomaly Detection', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = createApp();
  });

  afterEach(() => {
    resetSecurityMocks();
    resetSupabaseClient();
  });

  describe('Telemetry Stream & Anomaly Evaluation', () => {
    test('POST /api/assets/:id/telemetry ingests metrics and evaluates anomalies (201)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const assetId = 'asset-srv-1';
      const mockSupabase = {
        rpc: jest.fn().mockImplementation((fnName, params) => {
          if (fnName === 'ingest_and_evaluate_telemetry') {
            return Promise.resolve({
              data: {
                anomaly_detected: false,
                z_score_cpu: 0.42,
                status: 'nominal',
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post(`/api/assets/${assetId}/telemetry`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          cpu_usage: 45.5,
          memory_usage: 62.1,
          disk_usage: 55.0,
          latency_ms: 4.2,
          error_rate_percent: 0.0,
          bandwidth_usage_mbps: 150.0,
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Telemetry ingested and evaluated');
      expect(res.body.result.anomaly_detected).toBe(false);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'ingest_and_evaluate_telemetry',
        expect.objectContaining({
          p_asset_id: assetId,
          p_cpu: 45.5,
          p_mem: 62.1,
          p_disk: 55.0,
        })
      );
    });

    test('POST /api/assets/:id/telemetry rejects missing required metrics (400)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const res = await request(app)
        .post('/api/assets/asset-1/telemetry')
        .set('Authorization', `Bearer ${token}`)
        .send({ cpu_usage: 50.0 }); // Missing memory_usage and disk_usage

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('cpu_usage, memory_usage, and disk_usage are required');
    });

    test('GET /api/assets/:id/telemetry/history fetches historical time series (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const assetId = 'asset-srv-1';
      const mockHistory = [
        { sample_time: '2026-10-23T10:00:00Z', cpu_usage: 40.0, memory_usage: 50.0 },
      ];

      const mockSupabase = {
        rpc: jest.fn().mockImplementation((fnName) => {
          if (fnName === 'get_asset_telemetry_history') {
            return Promise.resolve({ data: mockHistory, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get(`/api/assets/${assetId}/telemetry/history?limit=10`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.history).toHaveLength(1);
      expect(res.body.count).toBe(1);
    });

    test('POST /api/telemetry/simulate triggers simulation step across assets (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [
                { id: 'asset-1', name: 'Web Server 1', type: 'hardware' },
                { id: 'asset-2', name: 'Core Router', type: 'network' },
              ],
              error: null,
            }),
          }),
        }),
        rpc: jest.fn().mockImplementation((fnName) => {
          if (fnName === 'ingest_and_evaluate_telemetry') {
            return Promise.resolve({ data: { evaluated: true }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post('/api/telemetry/simulate')
        .set('Authorization', `Bearer ${token}`)
        .send({ scenario: 'cpu_spike', target_asset_id: 'asset-1' });

      expect(res.status).toBe(200);
      expect(res.body.simulated_count).toBe(2);
      expect(res.body.scenario).toBe('cpu_spike');
      expect(res.body.results).toHaveLength(2);
    });

    test('GET /api/telemetry/anomalies/summary returns system overview (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const mockSummary = {
        total_telemetry_samples: 1250,
        total_anomalies_detected: 14,
        affected_assets_count: 3,
        recent_anomalies: [],
      };

      const mockSupabase = {
        rpc: jest.fn().mockImplementation((fnName) => {
          if (fnName === 'get_system_anomaly_overview') {
            return Promise.resolve({ data: mockSummary, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/telemetry/anomalies/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total_telemetry_samples).toBe(1250);
      expect(res.body.total_anomalies_detected).toBe(14);
    });
  });
});
