import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createAccessToken, setMockUserProfile, resetSecurityMocks } from '../src/core/security.js';
import { setSupabaseClient, resetSupabaseClient } from '../src/core/database.js';

describe('Phase 5: Advanced Systems - Post-Mortems & 5-Whys RCA', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = createApp();
  });

  afterEach(() => {
    resetSecurityMocks();
    resetSupabaseClient();
  });

  describe('Post-Mortem Lifecycle & RCA Exports', () => {
    test('POST /api/incidents/:id/postmortem/generate generates draft document (201)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'operator' }));

      const incidentId = 'inc-123';
      const mockSupabase = {
        rpc: jest.fn().mockImplementation((fnName) => {
          if (fnName === 'generate_incident_postmortem_draft') {
            return Promise.resolve({
              data: {
                id: 'pm-1',
                incident_id: incidentId,
                title: 'Outage RCA: Main DB Down',
                status: 'draft',
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post(`/api/incidents/${incidentId}/postmortem/generate`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Post-mortem draft generated');
      expect(res.body.postmortem.id).toBe('pm-1');
    });

    test('GET /api/incidents/:id/postmortem retrieves post-mortem report (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const incidentId = 'inc-123';
      const mockDoc = {
        id: 'pm-1',
        incident_id: incidentId,
        title: 'Network Partition Outage',
        status: 'under_review',
        impact_summary: { severity: 'high', duration_minutes: 45 },
      };

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockDoc, error: null }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get(`/api/incidents/${incidentId}/postmortem`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.postmortem.id).toBe('pm-1');
      expect(res.body.postmortem.title).toBe('Network Partition Outage');
    });

    test('PUT /api/incidents/:id/postmortem updates 5-whys and action items (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'operator' }));

      const incidentId = 'inc-123';
      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [{
                  id: 'pm-1',
                  incident_id: incidentId,
                  status: 'published',
                  root_cause_analysis: {
                    whys: ['Primary fiber link cut', 'Failover router configuration desync'],
                  },
                }],
                error: null,
              }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .put(`/api/incidents/${incidentId}/postmortem`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'published',
          root_cause_analysis: {
            methodology: '5_whys',
            whys: ['Primary fiber link cut', 'Failover router configuration desync'],
            root_cause_statement: 'Dual-path failover was misconfigured.',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Post-mortem updated successfully');
      expect(res.body.postmortem.status).toBe('published');
    });

    test('GET /api/incidents/:id/postmortem/export exports formatted Markdown document (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const incidentId = 'inc-123';
      const mockDoc = {
        id: 'pm-1',
        incident_id: incidentId,
        title: 'Global API Gateway Latency Spike',
        status: 'published',
        executive_summary: 'Gateway connection pool exhausted due to upstream auth service timeout.',
        impact_summary: {
          severity: 'critical',
          duration_minutes: 32,
          sla_breached: true,
          mttd_minutes: 3,
          mttr_minutes: 29,
        },
        root_cause_analysis: {
          whys: [
            'Connection pool saturated',
            'Auth service thread deadlock',
          ],
          root_cause_statement: 'Missing connection pool timeout ceiling.',
        },
        timeline_events: [
          { timestamp: '10:00 UTC', title: 'Alert fired', actor: 'Prometheus', description: 'HTTP 504 threshold exceeded' },
        ],
        preventative_action_items: [
          { task_description: 'Add circuit breaker', owner: 'DevOps', status: 'completed', priority: 'high', due_date: '2026-11-01' },
        ],
      };

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockDoc, error: null }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get(`/api/incidents/${incidentId}/postmortem/export`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.markdown).toBeDefined();
      expect(res.body.markdown).toContain('# 📋 Incident Post-Mortem: Global API Gateway Latency Spike');
      expect(res.body.markdown).toContain('## 4. Root Cause Analysis (5-Whys Framework)');
      expect(res.body.markdown).toContain('Connection pool saturated');
      expect(res.body.markdown).toContain('[x] **Add circuit breaker**');
    });
  });
});
