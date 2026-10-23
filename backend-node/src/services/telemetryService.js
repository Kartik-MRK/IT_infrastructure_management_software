/**
 * Service Layer for Telemetry Ingestion, Outlier Detection, and Chaos Simulation
 */

import { validateTelemetryPayload, validateSimulationPayload } from '../schemas/telemetrySchema.js';
import { TelemetryRepository } from '../repositories/telemetryRepository.js';

export class TelemetryService {
  /**
   * Validate payload and ingest metric through PostgreSQL anomaly evaluation engine
   */
  static async ingestMetric(assetId, payload, autoIncident = true) {
    const { data: cleaned, error } = validateTelemetryPayload(payload);
    if (error) {
      return { result: null, error, statusCode: 400 };
    }

    try {
      const result = await TelemetryRepository.ingestAndEvaluate(assetId, cleaned, autoIncident);
      return { result, error: null, statusCode: 201 };
    } catch (err) {
      return { result: null, error: `Failed to ingest telemetry: ${err.message}`, statusCode: 500 };
    }
  }

  /**
   * Fetch historical time-series samples for sparklines
   */
  static async getAssetHistory(assetId, limit = 30) {
    try {
      const history = await TelemetryRepository.getHistory(assetId, limit);
      return { history, error: null, statusCode: 200 };
    } catch (err) {
      return { history: [], error: `Failed to retrieve telemetry history: ${err.message}`, statusCode: 500 };
    }
  }

  /**
   * Fetch system-wide anomaly statistics and active breaches
   */
  static async getSystemSummary() {
    try {
      const summary = await TelemetryRepository.getSystemSummary();
      return { summary, error: null, statusCode: 200 };
    } catch (err) {
      return { summary: null, error: `Failed to retrieve anomaly summary: ${err.message}`, statusCode: 500 };
    }
  }

  /**
   * Execute a synthetic simulation step across active assets with optional chaos scenario
   */
  static async simulateTelemetryTick(payload) {
    const { data: cleaned, error } = validateSimulationPayload(payload || {});
    if (error) {
      return { result: null, error, statusCode: 400 };
    }

    const { scenario, target_asset_id: targetAssetId } = cleaned;

    try {
      const activeAssets = await TelemetryRepository.getActiveAssets();
      if (!activeAssets || activeAssets.length === 0) {
        return {
          result: { simulated_count: 0, scenario, results: [] },
          error: null,
          statusCode: 200,
        };
      }

      const uniform = (min, max) => Math.random() * (max - min) + min;
      const round2 = (val) => Math.round((Number(val) + Number.EPSILON) * 100) / 100;

      const results = [];
      for (const asset of activeAssets) {
        const assetId = asset.id;
        const assetType = asset.type || 'hardware';
        const isTarget =
          targetAssetId === assetId || (!targetAssetId && scenario !== 'normal');

        let baseCpu = 35.0 + uniform(-4.0, 4.0);
        let baseMem = 60.0 + uniform(-3.0, 3.0);
        let baseDisk = 52.0 + uniform(-1.0, 1.0);
        let baseLat = 3.5 + uniform(-1.0, 1.0);
        let baseErr = 0.0;
        let baseBw = 120.0 + uniform(-20.0, 30.0);

        if (assetType === 'network') {
          baseCpu = 22.0 + uniform(-3.0, 3.0);
          baseMem = 42.0 + uniform(-2.0, 2.0);
          baseDisk = 30.0;
          baseLat = 1.8 + uniform(-0.5, 0.8);
          baseErr = 0.0;
          baseBw = 450.0 + uniform(-50.0, 80.0);
        } else if (assetType !== 'hardware') {
          // software / cloud
          baseCpu = 18.0 + uniform(-2.0, 2.0);
          baseMem = 32.0 + uniform(-2.0, 2.0);
          baseDisk = 40.0;
          baseLat = 4.2 + uniform(-0.8, 1.2);
          baseErr = 0.0;
          baseBw = 85.0 + uniform(-15.0, 20.0);
        }

        // Inject Chaos Scenarios if target asset
        if (isTarget) {
          if (scenario === 'cpu_spike') {
            baseCpu = uniform(96.5, 99.2);
          } else if (scenario === 'memory_leak') {
            baseMem = uniform(93.8, 97.5);
          } else if (scenario === 'ddos_surge') {
            baseBw = uniform(920.0, 1200.0);
            baseLat = uniform(180.0, 350.0);
            baseErr = uniform(12.5, 24.0);
            baseCpu = uniform(88.0, 94.0);
          } else if (scenario === 'disk_exhaustion') {
            baseDisk = uniform(97.0, 99.5);
          }
        }

        const metricSample = {
          cpu_usage: round2(Math.min(100.0, Math.max(0.0, baseCpu))),
          memory_usage: round2(Math.min(100.0, Math.max(0.0, baseMem))),
          disk_usage: round2(Math.min(100.0, Math.max(0.0, baseDisk))),
          latency_ms: round2(Math.max(0.0, baseLat)),
          error_rate_percent: round2(Math.min(100.0, Math.max(0.0, baseErr))),
          bandwidth_usage_mbps: round2(Math.max(0.0, baseBw)),
        };

        const evalRes = await TelemetryRepository.ingestAndEvaluate(
          assetId,
          metricSample,
          true
        );

        results.push({
          asset_id: assetId,
          asset_name: asset.name,
          metrics: metricSample,
          evaluation: evalRes,
        });
      }

      return {
        result: {
          simulated_count: results.length,
          scenario,
          results,
        },
        error: null,
        statusCode: 200,
      };
    } catch (err) {
      return { result: null, error: `Failed to execute simulation: ${err.message}`, statusCode: 500 };
    }
  }
}
