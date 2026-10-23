/**
 * Telemetry & Anomaly Detection Schema Validation
 */

export const VALID_SCENARIOS = new Set([
  'normal',
  'cpu_spike',
  'memory_leak',
  'ddos_surge',
  'disk_exhaustion',
]);

/**
 * Validate incoming time-series telemetry sample
 */
export function validateTelemetryPayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { data: null, error: 'Invalid JSON payload' };
  }

  const { cpu_usage, memory_usage, disk_usage } = data;

  if (cpu_usage === undefined || memory_usage === undefined || disk_usage === undefined) {
    return { data: null, error: 'cpu_usage, memory_usage, and disk_usage are required' };
  }

  const cpuVal = parseFloat(cpu_usage);
  const memVal = parseFloat(memory_usage);
  const diskVal = parseFloat(disk_usage);
  const latencyVal = parseFloat(data.latency_ms !== undefined ? data.latency_ms : 5.0);
  const errorVal = parseFloat(data.error_rate_percent !== undefined ? data.error_rate_percent : 0.0);
  const bandwidthVal = parseFloat(data.bandwidth_usage_mbps !== undefined ? data.bandwidth_usage_mbps : 100.0);

  if (
    isNaN(cpuVal) ||
    isNaN(memVal) ||
    isNaN(diskVal) ||
    isNaN(latencyVal) ||
    isNaN(errorVal) ||
    isNaN(bandwidthVal)
  ) {
    return { data: null, error: 'All metric values must be numeric' };
  }

  if (
    cpuVal < 0.0 ||
    cpuVal > 100.0 ||
    memVal < 0.0 ||
    memVal > 100.0 ||
    diskVal < 0.0 ||
    diskVal > 100.0
  ) {
    return { data: null, error: 'Percentages must be between 0.0 and 100.0' };
  }

  const round2 = (val) => Math.round((Number(val) + Number.EPSILON) * 100) / 100;

  return {
    data: {
      cpu_usage: round2(cpuVal),
      memory_usage: round2(memVal),
      disk_usage: round2(diskVal),
      latency_ms: round2(Math.max(0.0, latencyVal)),
      error_rate_percent: round2(Math.min(100.0, Math.max(0.0, errorVal))),
      bandwidth_usage_mbps: round2(Math.max(0.0, bandwidthVal)),
    },
    error: null,
  };
}

/**
 * Validate simulation tick trigger payload
 */
export function validateSimulationPayload(data) {
  const payload = data && typeof data === 'object' && !Array.isArray(data) ? data : {};

  const scenario = payload.scenario || 'normal';
  if (!VALID_SCENARIOS.has(scenario)) {
    return {
      data: null,
      error: `Invalid scenario '${scenario}'. Must be one of: ${Array.from(VALID_SCENARIOS).sort().join(', ')}`,
    };
  }

  const targetAssetId = payload.target_asset_id;
  return {
    data: {
      scenario,
      target_asset_id: targetAssetId ? String(targetAssetId) : null,
    },
    error: null,
  };
}
