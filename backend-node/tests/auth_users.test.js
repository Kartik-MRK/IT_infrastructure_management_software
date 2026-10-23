import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  createAccessToken,
  setMockUserProfile,
  resetSecurityMocks,
} from '../src/core/security.js';
import { setSupabaseClient, resetSupabaseClient } from '../src/core/database.js';

describe('Phase 2: Authentication, Enterprise RBAC & Users', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = createApp();
  });

  afterEach(() => {
    resetSecurityMocks();
    resetSupabaseClient();
  });

  // --------------------------------------------------------------------------
  // AUTHENTICATION FLOW
  // --------------------------------------------------------------------------
  describe('Authentication Flow', () => {
    test('POST /api/auth/register creates user successfully (201)', async () => {
      const mockSupabase = {
        auth: {
          signUp: jest.fn().mockResolvedValue({
            data: {
              user: { id: 'new-user-123', email: 'newuser@test.com' },
            },
            error: null,
          }),
        },
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'newuser@test.com', password: 'Password123!', full_name: 'New User' });

      expect(res.status).toBe(201);
      expect(res.body.user).toEqual({
        id: 'new-user-123',
        email: 'newuser@test.com',
        full_name: 'New User',
      });
      expect(mockSupabase.auth.signUp).toHaveBeenCalled();
    });

    test('POST /api/auth/register rejects missing credentials (400)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'newuser@test.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email and password are required');
    });

    test('POST /api/auth/login succeeds with valid credentials (200)', async () => {
      const mockSupabase = {
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: {
              user: { id: 'user-123', email: 'test@test.com' },
              session: { access_token: 'sb-token', refresh_token: 'sb-refresh' },
            },
            error: null,
          }),
        },
      };
      setSupabaseClient(mockSupabase);
      setMockUserProfile(async () => ({
        id: 'user-123',
        email: 'test@test.com',
        full_name: 'Test User',
        role: 'operator',
      }));

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.access_token).toBeDefined();
      expect(res.body.user.email).toBe('test@test.com');
      expect(res.body.user.role).toBe('operator');
      expect(res.body.user.permissions).toContain('assets:create');
    });

    test('POST /api/auth/login rejects invalid credentials (401)', async () => {
      const mockSupabase = {
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Invalid login credentials' },
          }),
        },
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@test.com', password: 'badpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    test('POST /api/auth/login supports guest viewer bypass (200)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'guest.viewer@itims.local', password: 'any' });

      expect(res.status).toBe(200);
      expect(res.body.access_token).toBeDefined();
      expect(res.body.user.role).toBe('viewer');
      expect(res.body.user.email).toBe('guest.viewer@itims.local');
    });

    test('POST /api/auth/logout signs out user (200)', async () => {
      const mockSupabase = {
        auth: {
          signOut: jest.fn().mockResolvedValue({ error: null }),
        },
      };
      setSupabaseClient(mockSupabase);

      const token = createAccessToken('user-123');
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out successfully');
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    test('GET /api/auth/me returns current user profile & permissions (200)', async () => {
      const userId = 'user-123';
      const token = createAccessToken(userId);

      setMockUserProfile(async () => ({
        id: userId,
        email: 'admin@itims.local',
        full_name: 'Admin User',
        role: 'it_admin',
        gender: 'male',
      }));

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(userId);
      expect(res.body.user.role).toBe('it_admin');
      expect(res.body.user.permissions).toContain('admin:manage_roles');
    });
  });

  // --------------------------------------------------------------------------
  // ENTERPRISE RBAC & ROLES CATALOG
  // --------------------------------------------------------------------------
  describe('Enterprise RBAC Endpoints', () => {
    test('GET /api/roles returns available roles catalog', async () => {
      const token = createAccessToken('user-123');
      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [
                { id: 'it_admin', name: 'Global IT Administrator' },
                { id: 'infrastructure_engineer', name: 'Infrastructure & Systems Engineer' },
              ],
              error: null,
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.roles.length).toBe(2);
      expect(res.body.roles[0].id).toBe('it_admin');
    });

    test('GET /api/departments returns organization departments', async () => {
      const token = createAccessToken('user-123');
      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [
                { id: 'dept-1', name: 'Engineering', code: 'ENG' },
                { id: 'dept-2', name: 'IT Operations', code: 'OPS' },
              ],
              error: null,
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/departments')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.departments.length).toBe(2);
    });

    test('GET /api/audit-logs allows security_auditor (200)', async () => {
      const auditorId = 'auditor-123';
      const token = createAccessToken(auditorId);
      setMockUserProfile(async () => ({ id: auditorId, role: 'security_auditor' }));

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{ id: 'audit-1', table_name: 'assets', action: 'UPDATE' }],
                error: null,
              }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.audit_logs.length).toBe(1);
    });

    test('GET /api/audit-logs forbids viewer role (403)', async () => {
      const viewerId = 'viewer-123';
      const token = createAccessToken(viewerId);
      setMockUserProfile(async () => ({ id: viewerId, role: 'viewer' }));

      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });
  });

  // --------------------------------------------------------------------------
  // USER MANAGEMENT
  // --------------------------------------------------------------------------
  describe('User Management Endpoints', () => {
    test('GET /api/users allows admin and returns user list', async () => {
      const adminId = 'admin-123';
      const token = createAccessToken(adminId);
      setMockUserProfile(async () => ({ id: adminId, role: 'admin' }));

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [
                { id: adminId, email: 'admin@test.com', role: 'admin' },
                { id: 'user-2', email: 'user2@test.com', role: 'viewer' },
              ],
              error: null,
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.users.length).toBe(2);
    });

    test('PUT /api/users/:id/role allows admin to update user role (200)', async () => {
      const adminId = 'admin-123';
      const targetUserId = 'target-user-456';
      const token = createAccessToken(adminId);
      setMockUserProfile(async () => ({ id: adminId, role: 'admin' }));

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [{ id: targetUserId, role: 'operator' }],
                error: null,
              }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .put(`/api/users/${targetUserId}/role`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'operator' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('User role updated');
      expect(res.body.user.role).toBe('operator');
    });

    test('PUT /api/users/:id/role rejects invalid role (400)', async () => {
      const adminId = 'admin-123';
      const token = createAccessToken(adminId);
      setMockUserProfile(async () => ({ id: adminId, role: 'admin' }));

      const res = await request(app)
        .put('/api/users/target-456/role')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'super_hacker_role' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid role');
    });

    test('DELETE /api/users/:id prevents admin from deleting own account (400)', async () => {
      const adminId = 'admin-123';
      const token = createAccessToken(adminId);
      setMockUserProfile(async () => ({ id: adminId, role: 'admin' }));

      const res = await request(app)
        .delete(`/api/users/${adminId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Cannot delete your own account');
    });

    test('DELETE /api/users/:id allows admin to delete other user (200)', async () => {
      const adminId = 'admin-123';
      const targetUserId = 'other-user-999';
      const token = createAccessToken(adminId);
      setMockUserProfile(async () => ({ id: adminId, role: 'admin' }));

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .delete(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('User deleted successfully');
    });

    test('Parity check: /api/v1/users works identically to /api/users', async () => {
      const adminId = 'admin-123';
      const token = createAccessToken(adminId);
      setMockUserProfile(async () => ({ id: adminId, role: 'admin' }));

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [{ id: adminId, email: 'admin@test.com', role: 'admin' }],
              error: null,
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.users.length).toBe(1);
    });
  });
});
