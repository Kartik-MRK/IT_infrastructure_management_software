import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createAccessToken, setMockUserProfile, resetSecurityMocks } from '../src/core/security.js';
import { setSupabaseClient, resetSupabaseClient } from '../src/core/database.js';
import { setMockMailSender, resetMailMocks } from '../src/core/mail.js';

describe('Phase 3: Core IT Operations - Incidents & SLA Alerting', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = createApp();
  });

  afterEach(() => {
    resetSecurityMocks();
    resetSupabaseClient();
    resetMailMocks();
  });

  describe('Incident Lifecycle Endpoints', () => {
    test('POST /api/incidents creates incident and dispatches email on critical (201)', async () => {
      const reporterId = 'reporter-123';
      const token = createAccessToken(reporterId);
      setMockUserProfile(async () => ({
        id: reporterId,
        role: 'operator',
        email: 'reporter@itims.local',
        full_name: 'Test Reporter',
      }));

      const mockEmailSender = jest.fn().mockResolvedValue(true);
      setMockMailSender(mockEmailSender);

      const incidentPayload = {
        title: 'Production DB Down',
        description: 'Postgres primary replica unresponsive',
        severity: 'critical',
        priority: 9,
        category: 'Database',
      };

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: 'inc-123', ...incidentPayload, reported_by: reporterId, status: 'open' }],
              error: null,
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${token}`)
        .send(incidentPayload);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Incident reported successfully');
      expect(res.body.incident.id).toBe('inc-123');
      expect(mockEmailSender).toHaveBeenCalled();
    });

    test('POST /api/incidents rejects missing required fields (400)', async () => {
      const token = createAccessToken('user-123');
      setMockUserProfile(async () => ({ id: 'user-123', role: 'viewer' }));

      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'No severity or description' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required field');
    });

    test('GET /api/incidents returns list with filters (200)', async () => {
      const token = createAccessToken('user-123');

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [
                  { id: 'inc-1', title: 'Network Glitch', severity: 'low', status: 'open' },
                ],
                error: null,
              }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/incidents')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.incidents.length).toBe(1);
      expect(res.body.count).toBe(1);
    });

    test('PUT /api/incidents/:id/assign assigns incident and transitions open -> in_progress (200)', async () => {
      const operatorId = 'operator-123';
      const token = createAccessToken(operatorId);
      setMockUserProfile(async () => ({ id: operatorId, role: 'operator' }));

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'inc-assign-id', status: 'open' },
                error: null,
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [{ id: 'inc-assign-id', assigned_to: 'tech-999', status: 'in_progress' }],
                error: null,
              }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .put('/api/incidents/inc-assign-id/assign')
        .set('Authorization', `Bearer ${token}`)
        .send({ assigned_to: 'tech-999' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Incident assigned successfully');
      expect(res.body.incident.status).toBe('in_progress');
      expect(res.body.incident.assigned_to).toBe('tech-999');
    });

    test('PUT /api/incidents/:id/status updates status and sets resolution timestamp on resolved (200)', async () => {
      const operatorId = 'operator-123';
      const token = createAccessToken(operatorId);
      setMockUserProfile(async () => ({ id: operatorId, role: 'operator' }));

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'inc-resolve-id', status: 'in_progress' },
                error: null,
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [{
                  id: 'inc-resolve-id',
                  status: 'resolved',
                  resolution_notes: 'Replaced failed PSU',
                  resolved_by: operatorId,
                }],
                error: null,
              }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .put('/api/incidents/inc-resolve-id/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'resolved', resolution_notes: 'Replaced failed PSU' });

      expect(res.status).toBe(200);
      expect(res.body.incident.status).toBe('resolved');
      expect(res.body.incident.resolution_notes).toBe('Replaced failed PSU');
    });

    test('POST /api/incidents/:id/escalate escalates priority and sets severity to critical if >= 8 (200)', async () => {
      const operatorId = 'operator-123';
      const token = createAccessToken(operatorId);
      setMockUserProfile(async () => ({ id: operatorId, role: 'operator' }));

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'inc-esc-id', priority: 7, severity: 'high' },
                error: null,
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [{ id: 'inc-esc-id', priority: 9, severity: 'critical' }],
                error: null,
              }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post('/api/incidents/inc-esc-id/escalate')
        .set('Authorization', `Bearer ${token}`)
        .send({ priority_boost: 2 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Incident escalated successfully');
      expect(res.body.incident.priority).toBe(9);
      expect(res.body.incident.severity).toBe('critical');
    });

    test('DELETE /api/incidents/:id allows admin to delete incident (200)', async () => {
      const adminId = 'admin-123';
      const token = createAccessToken(adminId);
      setMockUserProfile(async () => ({ id: adminId, role: 'admin' }));

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'inc-del-id', title: 'Delete me' },
                error: null,
              }),
            }),
          }),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .delete('/api/incidents/inc-del-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Incident deleted successfully');
    });
  });
});
