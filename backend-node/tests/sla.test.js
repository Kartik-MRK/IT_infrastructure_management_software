import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createAccessToken, setMockUserProfile, resetSecurityMocks } from '../src/core/security.js';
import { setSupabaseClient, resetSupabaseClient } from '../src/core/database.js';

describe('Phase 5: Advanced Systems - SLA Engine & Timers', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = createApp();
  });

  afterEach(() => {
    resetSecurityMocks();
    resetSupabaseClient();
  });

  describe('SLA Policy Management & Response Tracking', () => {
    test('GET /api/sla/policies lists configured policies (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const mockPolicies = [
        { id: 'sla-1', severity: 'critical', max_response_time_minutes: 15, max_resolution_time_minutes: 120 },
        { id: 'sla-2', severity: 'high', max_response_time_minutes: 30, max_resolution_time_minutes: 240 },
      ];

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: mockPolicies, error: null }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/sla/policies')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.policies).toHaveLength(2);
      expect(res.body.policies[0].severity).toBe('critical');
    });

    test('PUT /api/sla/policies/:id updates SLA targets for admin (200)', async () => {
      const adminId = 'admin-1';
      const token = createAccessToken(adminId);
      setMockUserProfile(async () => ({ id: adminId, role: 'it_admin' }));

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'sla-1', policy_name: 'Critical SLA', max_response_time_minutes: 15 },
                error: null,
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [{ id: 'sla-1', policy_name: 'P1 Ultra Critical', max_response_time_minutes: 10 }],
                error: null,
              }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .put('/api/sla/policies/sla-1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          policy_name: 'P1 Ultra Critical',
          max_response_time_minutes: 10,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('SLA Policy updated successfully');
      expect(res.body.policy.max_response_time_minutes).toBe(10);
    });

    test('PUT /api/sla/policies/:id rejects non-admin user (403)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'operator' }));

      const res = await request(app)
        .put('/api/sla/policies/sla-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ max_response_time_minutes: 10 });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Only administrators can modify SLA policies');
    });

    test('POST /api/incidents/:id/acknowledge records response and checks deadline breach (200)', async () => {
      const token = createAccessToken('tech-1');
      setMockUserProfile(async () => ({ id: 'tech-1', role: 'technician' }));

      const incidentId = 'inc-123';
      const futureDeadline = new Date(Date.now() + 3600000).toISOString();

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: incidentId,
                  response_deadline: futureDeadline,
                  first_responded_at: null,
                  sla_response_breached: false,
                },
                error: null,
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [{
                  id: incidentId,
                  first_responded_at: new Date().toISOString(),
                  sla_response_breached: false,
                }],
                error: null,
              }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post(`/api/incidents/${incidentId}/acknowledge`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.incident.sla_response_breached).toBe(false);
      expect(res.body.incident.first_responded_at).toBeDefined();
    });

    test('GET /api/sla/summary returns organization scorecard (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const mockSummary = {
        total_incidents: 50,
        resolved_incidents: 45,
        resolved_within_sla: 42,
        sla_compliance_percentage: 93.33,
        avg_mttd_minutes: 8.5,
        avg_mttr_minutes: 42.0,
      };

      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ data: [mockSummary], error: null }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/sla/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.sla_compliance_percentage).toBe(93.33);
      expect(res.body.avg_mttr_minutes).toBe(42.0);
    });
  });
});
