/**
 * Financial Service for Depreciation Schedules, TCO & Budget Forecasting
 */

import { FinancialRepository } from '../repositories/financialRepository.js';
import { AssetRepository } from '../repositories/assetRepository.js';

export class FinancialService {
  /**
   * Helper to round float to 2 decimal places
   */
  static round2(val) {
    return Math.round((Number(val) + Number.EPSILON) * 100) / 100;
  }

  /**
   * Generate year-by-year depreciation curve for an asset
   */
  static generateDepreciationSchedule(cost, salvageValue, usefulLifeYears, method, purchaseDateStr) {
    const costVal = parseFloat(cost) || 0.0;
    const salvage = parseFloat(salvageValue) || 0.0;
    const life = parseInt(usefulLifeYears, 10) || 5;
    const normMethod = String(method || 'straight_line').toLowerCase();

    const schedule = [];
    let currentBook = costVal;
    let accumDep = 0.0;

    let startYear = new Date().getFullYear();
    if (purchaseDateStr) {
      try {
        const parsedYear = new Date(String(purchaseDateStr).slice(0, 10)).getFullYear();
        if (!isNaN(parsedYear)) {
          startYear = parsedYear;
        }
      } catch {
        // fallback to current year
      }
    }

    if (normMethod === 'straight_line' && costVal > salvage && life > 0) {
      const annualDep = FinancialService.round2((costVal - salvage) / life);
      for (let y = 1; y <= life; y++) {
        const depAmount = FinancialService.round2(Math.min(annualDep, currentBook - salvage));
        currentBook = Math.max(salvage, currentBook - depAmount);
        accumDep = FinancialService.round2(accumDep + depAmount);
        schedule.push({
          year_index: y,
          calendar_year: startYear + y,
          depreciation_expense: depAmount,
          accumulated_depreciation: accumDep,
          ending_book_value: FinancialService.round2(currentBook),
        });
      }
    } else if (normMethod === 'double_declining' && costVal > salvage && life > 0) {
      const rate = 2.0 / life;
      for (let y = 1; y <= life; y++) {
        let depAmount = FinancialService.round2(currentBook * rate);
        if (currentBook - depAmount < salvage) {
          depAmount = FinancialService.round2(Math.max(0.0, currentBook - salvage));
        }
        currentBook = Math.max(salvage, currentBook - depAmount);
        accumDep = FinancialService.round2(accumDep + depAmount);
        schedule.push({
          year_index: y,
          calendar_year: startYear + y,
          depreciation_expense: depAmount,
          accumulated_depreciation: accumDep,
          ending_book_value: FinancialService.round2(currentBook),
        });
      }
    } else {
      // None or zero cost
      for (let y = 1; y <= life; y++) {
        schedule.push({
          year_index: y,
          calendar_year: startYear + y,
          depreciation_expense: 0.0,
          accumulated_depreciation: 0.0,
          ending_book_value: costVal,
        });
      }
    }

    return schedule;
  }

  /**
   * Fetch detailed financials, depreciation schedule, and maintenance OpEx for an asset
   */
  static async getAssetFinancialBreakdown(assetId) {
    const assetRes = await AssetRepository.getById(assetId);
    const asset = assetRes?.data || (assetRes && !assetRes.error ? assetRes : null);
    if (!asset) {
      return { data: null, error: 'Asset not found', statusCode: 404 };
    }

    let financials = await FinancialRepository.getAssetFinancials(assetId);
    if (!financials) {
      // Fallback calculation if RPC returns null/empty
      const cost = parseFloat(asset.cost) || 0.0;
      const salvage = parseFloat(asset.salvage_value) || 0.0;
      const life = parseInt(asset.useful_life_years, 10) || 5;
      const method = asset.depreciation_method || 'straight_line';

      financials = {
        asset_id: asset.id,
        asset_name: asset.name,
        asset_type: asset.type,
        purchase_cost: cost,
        salvage_value: salvage,
        useful_life_years: life,
        depreciation_method: method,
        purchase_date: asset.purchase_date,
        age_months: 0.0,
        age_years: 0.0,
        current_book_value: cost,
        accumulated_depreciation: 0.0,
        annual_depreciation: 0.0,
        maintenance_cost_total: 0.0,
        license_cost_total: 0.0,
        total_cost_of_ownership: cost,
      };
    }

    // Fetch contributing maintenance incidents
    const maintIncidents = await FinancialRepository.getAssetMaintenanceIncidents(assetId);

    // Generate 5-year depreciation schedule
    const schedule = FinancialService.generateDepreciationSchedule(
      financials.purchase_cost,
      financials.salvage_value,
      financials.useful_life_years,
      financials.depreciation_method,
      financials.purchase_date
    );

    // Evaluate TCO Health & Maintenance Burden
    const purchaseCost = parseFloat(financials.purchase_cost) || 0.0;
    const maintCost = parseFloat(financials.maintenance_cost_total) || 0.0;

    let healthVerdict = 'HEALTHY';
    if (purchaseCost > 0) {
      if (maintCost >= 0.6 * purchaseCost) {
        healthVerdict = 'REPLACEMENT_RECOMMENDED';
      } else if (maintCost >= 0.3 * purchaseCost) {
        healthVerdict = 'ELEVATED_MAINTENANCE';
      }
    }

    return {
      data: {
        financials,
        health_verdict: healthVerdict,
        maintenance_incidents: maintIncidents,
        depreciation_schedule: schedule,
      },
      error: null,
      statusCode: 200,
    };
  }

  /**
   * Retrieve organization-wide financial KPIs and TCO metrics
   */
  static async getExecutiveFinancialOverview() {
    const data = await FinancialRepository.getExecutiveSummary();
    if (!data) {
      return {
        data: {
          overview: {
            total_assets_tracked: 0,
            total_capitalized_investment: 0.0,
            total_current_book_value: 0.0,
            total_accumulated_depreciation: 0.0,
            total_maintenance_expenditure: 0.0,
            total_software_licensing_spend: 0.0,
            total_infrastructure_tco: 0.0,
            overall_depreciation_percent: 0.0,
          },
          by_type: {},
        },
        error: null,
        statusCode: 200,
      };
    }
    return { data, error: null, statusCode: 200 };
  }

  /**
   * 5-Year forward depreciation forecast across all capital assets
   */
  static async getDepreciationForecast() {
    const assets = await FinancialRepository.getAllActiveAssets();
    const currentYear = new Date().getFullYear();

    const forecastByYear = {};
    for (let i = 1; i <= 5; i++) {
      const yr = currentYear + i;
      forecastByYear[String(yr)] = {
        year: yr,
        projected_book_value: 0.0,
        projected_depreciation_expense: 0.0,
      };
    }

    for (const a of assets) {
      const cost = parseFloat(a.cost) || 0.0;
      const salvage = parseFloat(a.salvage_value) || 0.0;
      const life = parseInt(a.useful_life_years, 10) || 5;
      const method = a.depreciation_method || 'straight_line';
      const pdate = a.purchase_date;

      const sched = FinancialService.generateDepreciationSchedule(cost, salvage, life, method, pdate);
      for (const item of sched) {
        const yrKey = String(item.calendar_year);
        if (forecastByYear[yrKey]) {
          forecastByYear[yrKey].projected_book_value = FinancialService.round2(
            forecastByYear[yrKey].projected_book_value + item.ending_book_value
          );
          forecastByYear[yrKey].projected_depreciation_expense = FinancialService.round2(
            forecastByYear[yrKey].projected_depreciation_expense + item.depreciation_expense
          );
        }
      }
    }

    const forecastList = Object.keys(forecastByYear)
      .sort()
      .map((k) => forecastByYear[k]);

    return {
      data: { forecast: forecastList },
      error: null,
      statusCode: 200,
    };
  }
}
