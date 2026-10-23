import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  createAccessToken,
  getCurrentUserId,
  roleRequired,
  setMockUserProfile,
  resetSecurityMocks,
} from '../src/core/security.js';

describe('Phase 1: Core Infrastructure & Health Endpoints', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = createApp();
  });

  afterEach(() => {
    resetSecurityMocks();
  });

  test('GET /health returns healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'healthy',
      message: 'API is running',
      service: 'ITIMS Backend',
    });
  });

  test('GET /api/health returns healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'healthy',
      message: 'API is running',
      service: 'ITIMS Backend',
    });
  });

  test('GET non-existent endpoint returns 404 with error contract', async () => {
    const res = await request(app).get('/api/v1/non-existent-endpoint');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Endpoint not found',
    });
  });

  test('createAccessToken generates valid JWT with sub claim', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const token = createAccessToken(userId);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const mockReq = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };
    const extractedId = getCurrentUserId(mockReq);
    expect(extractedId).toBe(userId);
  });

  test('roleRequired middleware rejects requests with missing token (401)', async () => {
    const testApp = createApp((r) => {
      r.get('/api/test-protected', roleRequired(['admin']), (_req, res) => {
        res.json({ success: true });
      });
    });

    const res = await request(testApp).get('/api/test-protected');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: 'Missing or invalid token',
      message: 'Authorization header is required',
    });
  });

  test('roleRequired middleware enforces role hierarchy and aliases', async () => {
    const testApp = createApp((r) => {
      r.get('/api/test-operator', roleRequired(['operator']), (req, res) => {
        res.json({ success: true, user: req.currentUser });
      });
    });

    const userId = 'user-test-uuid';
    const token = createAccessToken(userId);

    // 1. Viewer trying to access operator endpoint should get 403 Forbidden
    setMockUserProfile(async () => ({ id: userId, role: 'viewer', full_name: 'Test Viewer' }));
    const resForbidden = await request(testApp)
      .get('/api/test-operator')
      .set('Authorization', `Bearer ${token}`);
    expect(resForbidden.status).toBe(403);
    expect(resForbidden.body.error).toBe('Forbidden');

    // 2. Operator should be allowed (200)
    setMockUserProfile(async () => ({ id: userId, role: 'operator', full_name: 'Test Operator' }));
    const resAllowed = await request(testApp)
      .get('/api/test-operator')
      .set('Authorization', `Bearer ${token}`);
    expect(resAllowed.status).toBe(200);
    expect(resAllowed.body.success).toBe(true);

    // 3. Admin should have universal access via role hierarchy (200)
    setMockUserProfile(async () => ({ id: userId, role: 'admin', full_name: 'Test Admin' }));
    const resAdmin = await request(testApp)
      .get('/api/test-operator')
      .set('Authorization', `Bearer ${token}`);
    expect(resAdmin.status).toBe(200);
    expect(resAdmin.body.success).toBe(true);
  });
});
