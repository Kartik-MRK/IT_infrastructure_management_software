import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createAccessToken, setMockUserProfile, resetSecurityMocks } from '../src/core/security.js';
import { setSupabaseClient, resetSupabaseClient } from '../src/core/database.js';

describe('Phase 3: Core IT Operations - Assets & CMDB Topology', () => {
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
  // ASSET CRUD
  // --------------------------------------------------------------------------
  describe('Asset CRUD Endpoints', () => {
    test('GET /api/assets returns asset list and role (200)', async () => {
      const token = createAccessToken('user-123');
      setMockUserProfile(async () => ({ id: 'user-123', role: 'viewer' }));

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnThis(),
            then: jest.fn((resolve) => resolve({
              data: [
                { id: 'asset-1', name: 'Core Router', type: 'network', status: 'active' },
              ],
              error: null,
            })),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/assets')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.assets.length).toBe(1);
      expect(res.body.user_role).toBe('viewer');
    });

    test('POST /api/assets creates an asset with valid data (201)', async () => {
      const token = createAccessToken('admin-123');
      setMockUserProfile(async () => ({ id: 'admin-123', role: 'admin' }));

      const newAsset = {
        name: 'Database Cluster Node 1',
        type: 'infrastructure',
        status: 'active',
        cost: 4500.5,
      };

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: 'new-asset-id', ...newAsset, created_by: 'admin-123' }],
              error: null,
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${token}`)
        .send(newAsset);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Asset created successfully');
      expect(res.body.asset.id).toBe('new-asset-id');
      expect(res.body.asset.created_by).toBe('admin-123');
    });

    test('POST /api/assets rejects missing required fields (400)', async () => {
      const token = createAccessToken('admin-123');
      setMockUserProfile(async () => ({ id: 'admin-123', role: 'admin' }));

      const res = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Incomplete Asset' }); // missing type and status

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required field');
    });

    test('GET /api/assets/:id returns single asset (200) or 404', async () => {
      const token = createAccessToken('user-123');
      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'asset-1', name: 'Web Server', type: 'hardware' },
                error: null,
              }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/assets/asset-1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.asset.id).toBe('asset-1');
    });

    test('PUT /api/assets/:id operator restricted from editing assets created by others (403)', async () => {
      const operatorId = 'operator-123';
      const token = createAccessToken(operatorId);
      setMockUserProfile(async () => ({ id: operatorId, role: 'operator' }));

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'asset-other', name: 'Other Asset', created_by: 'someone-else' },
                error: null,
              }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .put('/api/assets/asset-other')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'maintenance' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Operators can only edit assets they created');
    });

    test('DELETE /api/assets/:id allows admin to delete asset (200)', async () => {
      const token = createAccessToken('admin-123');
      setMockUserProfile(async () => ({ id: 'admin-123', role: 'admin' }));

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'asset-delete-id', name: 'Old Asset' },
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
        .delete('/api/assets/asset-delete-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Asset deleted successfully');
    });

    test('GET /api/assets/:id/qr generates QR Code Data URL (200)', async () => {
      const token = createAccessToken('user-123');
      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'asset-qr-id', name: 'QR Asset', serial_number: 'SN-999', type: 'hardware' },
                error: null,
              }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/assets/asset-qr-id/qr')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.asset_id).toBe('asset-qr-id');
      expect(res.body.qr_code).toMatch(/^data:image\/png;base64,/);
    });

    test('POST /api/assets/bulk-status updates multiple assets (200)', async () => {
      const token = createAccessToken('admin-123');
      setMockUserProfile(async () => ({ id: 'admin-123', role: 'admin' }));

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post('/api/assets/bulk-status')
        .set('Authorization', `Bearer ${token}`)
        .send({ asset_ids: ['a1', 'a2'], status: 'maintenance' });

      expect(res.status).toBe(200);
      expect(res.body.updated_count).toBe(2);
      expect(res.body.status).toBe('maintenance');
    });
  });

  // --------------------------------------------------------------------------
  // CMDB & TOPOLOGY GRAPH
  // --------------------------------------------------------------------------
  describe('CMDB Topology Endpoints', () => {
    test('POST /api/assets/:id/relationships rejects self-loop (400)', async () => {
      const token = createAccessToken('admin-123');
      setMockUserProfile(async () => ({ id: 'admin-123', role: 'admin' }));

      const res = await request(app)
        .post('/api/assets/asset-1/relationships')
        .set('Authorization', `Bearer ${token}`)
        .send({
          child_asset_id: 'asset-1', // self-loop
          relationship_type: 'depends_on',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('self-loop forbidden');
    });

    test('POST /api/assets/:id/relationships creates dependency (201)', async () => {
      const token = createAccessToken('admin-123');
      setMockUserProfile(async () => ({ id: 'admin-123', role: 'admin' }));

      const mockSupabase = {
        table: jest.fn((table) => {
          if (table === 'assets') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'parent-1', name: 'Parent Host' },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'asset_relationships') {
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockResolvedValue({
                  data: [{ id: 'rel-1', parent_asset_id: 'parent-1', child_asset_id: 'child-2', relationship_type: 'hosts' }],
                  error: null,
                }),
              }),
            };
          }
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post('/api/assets/parent-1/relationships')
        .set('Authorization', `Bearer ${token}`)
        .send({
          child_asset_id: 'child-2',
          relationship_type: 'hosts',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Relationship created successfully');
      expect(res.body.relationship.id).toBe('rel-1');
    });

    test('GET /api/assets/:id/blast-radius returns computed impact & risk level (200)', async () => {
      const token = createAccessToken('user-123');
      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'root-switch', name: 'Core Switch', type: 'network', status: 'active' },
                error: null,
              }),
            }),
          }),
        }),
        rpc: jest.fn().mockResolvedValue({
          data: [
            { asset_id: 'downstream-1', asset_name: 'App Server', depth: 1, asset_type: 'hardware' },
          ],
          error: null,
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/assets/root-switch/blast-radius')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.root_asset.id).toBe('root-switch');
      expect(res.body.summary.total_impacted).toBe(1);
      expect(res.body.risk_level).toBe('MEDIUM');
    });

    test('GET /api/assets/:id/topology returns React Flow nodes and edges (200)', async () => {
      const token = createAccessToken('user-123');
      const mockSupabase = {
        table: jest.fn((table) => {
          if (table === 'assets') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'root-id', name: 'Root Server', type: 'hardware', status: 'active' },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'asset_relationships') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            };
          }
        }),
        rpc: jest.fn().mockResolvedValue({ data: [] }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/assets/root-id/topology')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.nodes)).toBe(true);
      expect(res.body.nodes[0].data.isRoot).toBe(true);
      expect(Array.isArray(res.body.edges)).toBe(true);
    });
  });
});
