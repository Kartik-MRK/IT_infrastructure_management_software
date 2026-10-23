import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createAccessToken, setMockUserProfile, resetSecurityMocks } from '../src/core/security.js';
import { setSupabaseClient, resetSupabaseClient } from '../src/core/database.js';
import { FinancialService } from '../src/services/financialService.js';

describe('Phase 4: Management Modules - Financial Lifecycle, Depreciation & TCO', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = createApp();
  });

  afterEach(() => {
    resetSecurityMocks();
    resetSupabaseClient();
  });

  describe('Mathematical Depreciation Engine Unit Logic', () => {
    test('Calculates Straight-Line depreciation correctly', () => {
      // Cost: 5000, Salvage: 500, Life: 5 -> Annual = (5000 - 500) / 5 = 900
      const schedule = FinancialService.generateDepreciationSchedule(
        5000,
        500,
        5,
        'straight_line',
        '2024-01-01'
      );

      expect(schedule).toHaveLength(5);
      expect(schedule[0].depreciation_expense).toBe(900);
      expect(schedule[0].ending_book_value).toBe(4100);
      expect(schedule[4].ending_book_value).toBe(500);
      expect(schedule[4].accumulated_depreciation).toBe(4500);
    });

    test('Calculates Double-Declining Balance (DDB) depreciation with salvage floor', () => {
      // Cost: 10000, Salvage: 1000, Life: 5 -> Rate = 2/5 = 0.40
      const schedule = FinancialService.generateDepreciationSchedule(
        10000,
        1000,
        5,
        'double_declining',
        '2024-01-01'
      );

      expect(schedule).toHaveLength(5);
      // Year 1: 10000 * 0.4 = 4000 -> ending 6000
      expect(schedule[0].depreciation_expense).toBe(4000);
      expect(schedule[0].ending_book_value).toBe(6000);
      // Year 2: 6000 * 0.4 = 2400 -> ending 3600
      expect(schedule[1].depreciation_expense).toBe(2400);
      expect(schedule[1].ending_book_value).toBe(3600);
      // Ending book value must never drop below salvage
      for (const item of schedule) {
        expect(item.ending_book_value).toBeGreaterThanOrEqual(1000);
      }
    });
  });

  describe('Financial Routes', () => {
    test('GET /api/assets/:id/financials returns TCO breakdown and health verdict (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const assetId = 'asset-srv-1';
      const mockSupabase = {
        table: jest.fn().mockImplementation((tableName) => {
          if (tableName === 'assets') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: {
                      id: assetId,
                      name: 'Database Cluster',
                      type: 'server',
                      cost: 10000.0,
                      salvage_value: 1000.0,
                      useful_life_years: 5,
                      depreciation_method: 'straight_line',
                      purchase_date: '2023-01-01',
                    },
                    error: null,
                  }),
                  is: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: {
                        id: assetId,
                        name: 'Database Cluster',
                        type: 'server',
                        cost: 10000.0,
                        salvage_value: 1000.0,
                        useful_life_years: 5,
                        depreciation_method: 'straight_line',
                        purchase_date: '2023-01-01',
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (tableName === 'incidents') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [
                      { id: 'inc-1', title: 'Drive Failure', maintenance_cost: 3500.0 },
                    ],
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
        rpc: jest.fn().mockImplementation((fnName) => {
          if (fnName === 'calculate_asset_financials') {
            return Promise.resolve({
              data: [
                {
                  asset_id: assetId,
                  asset_name: 'Database Cluster',
                  purchase_cost: 10000.0,
                  salvage_value: 1000.0,
                  useful_life_years: 5,
                  depreciation_method: 'straight_line',
                  purchase_date: '2023-01-01',
                  maintenance_cost_total: 3500.0, // 35% of cost -> ELEVATED_MAINTENANCE
                  total_cost_of_ownership: 13500.0,
                },
              ],
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get(`/api/assets/${assetId}/financials`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.health_verdict).toBe('ELEVATED_MAINTENANCE');
      expect(res.body.financials.purchase_cost).toBe(10000.0);
      expect(res.body.depreciation_schedule).toHaveLength(5);
      expect(res.body.maintenance_incidents).toHaveLength(1);
    });

    test('GET /api/financials/executive-summary returns portfolio metrics (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const mockExecSummary = {
        overview: {
          total_assets_tracked: 45,
          total_capitalized_investment: 250000.0,
          total_current_book_value: 180000.0,
          total_accumulated_depreciation: 70000.0,
          total_maintenance_expenditure: 15000.0,
          total_software_licensing_spend: 32000.0,
          total_infrastructure_tco: 297000.0,
          overall_depreciation_percent: 28.0,
        },
        by_type: {},
      };

      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ data: [mockExecSummary], error: null }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/financials/executive-summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.overview.total_capitalized_investment).toBe(250000.0);
      expect(res.body.overview.total_infrastructure_tco).toBe(297000.0);
    });

    test('GET /api/financials/depreciation-forecast generates 5-year budget forecast (200)', async () => {
      const token = createAccessToken('user-1');
      setMockUserProfile(async () => ({ id: 'user-1', role: 'viewer' }));

      const mockActiveAssets = [
        {
          id: 'asset-1',
          name: 'Server 1',
          cost: 10000,
          salvage_value: 0,
          useful_life_years: 5,
          depreciation_method: 'straight_line',
          purchase_date: '2025-01-01',
        },
      ];

      const mockSupabase = {
        table: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockResolvedValue({ data: mockActiveAssets, error: null }),
            }),
          }),
        }),
      };
      setSupabaseClient(mockSupabase);

      const res = await request(app)
        .get('/api/financials/depreciation-forecast')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.forecast).toHaveLength(5);
      expect(res.body.forecast[0]).toHaveProperty('year');
      expect(res.body.forecast[0]).toHaveProperty('projected_book_value');
      expect(res.body.forecast[0]).toHaveProperty('projected_depreciation_expense');
    });
  });
});
