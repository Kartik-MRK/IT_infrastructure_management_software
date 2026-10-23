import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createAccessToken, setMockUserProfile, resetSecurityMocks } from '../src/core/security.js';
import { setSupabaseClient, resetSupabaseClient } from '../src/core/database.js';

describe('Phase 5: Advanced Systems - Cryptographic Ledger & SOC 2 Audits', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = createApp();
  });

  afterEach(() => {
    resetSecurityMocks();
    resetSupabaseClient();
  });

  describe('Cryptographic Hash Chaining & Chain Sweeps', () => {
    test('POST /api/audit-ledger/verify runs cryptographic integrity sweep (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'admin' }));

      const mockReport = {
        total_blocks_verified: 154,
        is_chain_valid: true,
        tampered_blocks: [],
        latest_merkle_root: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      };

      const mockSupabase = {
        rpc: jest.fn().mockImplementation((fnName) => {
          if (fnName === 'verify_audit_log_chain_integrity') {
            return Promise.resolve({ data: mockReport, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post('/api/audit-ledger/verify')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Cryptographic integrity sweep completed');
      expect(res.body.integrity_report.is_chain_valid).toBe(true);
      expect(res.body.integrity_report.total_blocks_verified).toBe(154);
    });

    test('GET /api/audit-ledger/compliance-certificate generates signed certificate (200)', async () => {
      const token = createAccessToken('auditor-1');
      setMockUserProfile(async () => ({ id: 'auditor-1', full_name: 'Lead Auditor', role: 'security_auditor' }));

      const mockCertificate = {
        certificate_id: 'SOC2-2026-CERT-001',
        auditor_name: 'Lead Auditor',
        standard: 'SOC 2 Type II / ISO 27001',
        issued_at: '2026-10-23T10:00:00Z',
        chain_status: 'VERIFIED_VALID',
      };

      const mockSupabase = {
        rpc: jest.fn().mockImplementation((fnName, params) => {
          if (fnName === 'generate_compliance_certificate') {
            return Promise.resolve({ data: mockCertificate, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/audit-ledger/compliance-certificate?auditor_name=Lead%20Auditor')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.certificate.certificate_id).toBe('SOC2-2026-CERT-001');
      expect(res.body.certificate.standard).toContain('SOC 2');
    });

    test('POST /api/audit-ledger/log appends new block to hash chain (201)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', email: 'admin@itims.local', role: 'admin' }));

      const mockSupabase = {
        rpc: jest.fn().mockImplementation((fnName) => {
          if (fnName === 'append_cryptographic_audit_log') {
            return Promise.resolve({
              data: {
                sequence_number: 155,
                previous_hash: 'prev-hash-abc',
                current_hash: 'curr-hash-xyz',
                action: 'ROLE_ELEVATION',
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .post('/api/audit-ledger/log')
        .set('Authorization', `Bearer ${token}`)
        .send({
          action: 'ROLE_ELEVATION',
          entity_type: 'USER',
          entity_id: 'user-target-1',
          payload: { old_role: 'operator', new_role: 'admin' },
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Audit log appended to cryptographic chain');
      expect(res.body.audit_entry.sequence_number).toBe(155);
    });

    test('GET /api/audit-ledger retrieves paginated audit chain entries (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const mockLogs = [
        { sequence_number: 2, action: 'ASSET_CREATED', current_hash: 'hash2' },
        { sequence_number: 1, action: 'GENESIS', current_hash: 'hash1' },
      ];

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({ data: mockLogs, error: null }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/audit-ledger?limit=10&offset=0')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.audit_logs).toHaveLength(2);
      expect(res.body.count).toBe(2);
    });
  });
});
