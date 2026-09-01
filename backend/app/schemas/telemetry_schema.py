"""Telemetry & Anomaly Detection Schema Validation"""

VALID_SCENARIOS = {'normal', 'cpu_spike', 'memory_leak', 'ddos_surge', 'disk_exhaustion'}

def validate_telemetry_payload(data: dict):
    """Validate incoming time-series telemetry sample"""
    if not isinstance(data, dict):
        return None, "Invalid JSON payload"

    cpu = data.get('cpu_usage')
    mem = data.get('memory_usage')
    disk = data.get('disk_usage')

    if cpu is None or mem is None or disk is None:
        return None, "cpu_usage, memory_usage, and disk_usage are required"

    try:
        cpu_val = float(cpu)
        mem_val = float(mem)
        disk_val = float(disk)
        latency_val = float(data.get('latency_ms', 5.0))
        error_val = float(data.get('error_rate_percent', 0.0))
        bandwidth_val = float(data.get('bandwidth_usage_mbps', 100.0))
    except (ValueError, TypeError):
        return None, "All metric values must be numeric"

    if not (0.0 <= cpu_val <= 100.0) or not (0.0 <= mem_val <= 100.0) or not (0.0 <= disk_val <= 100.0):
        return None, "Percentages must be between 0.0 and 100.0"

    return {
        'cpu_usage': round(cpu_val, 2),
        'memory_usage': round(mem_val, 2),
        'disk_usage': round(disk_val, 2),
        'latency_ms': round(max(0.0, latency_val), 2),
        'error_rate_percent': round(min(100.0, max(0.0, error_val)), 2),
        'bandwidth_usage_mbps': round(max(0.0, bandwidth_val), 2)
    }, None

def validate_simulation_payload(data: dict):
    """Validate simulation tick trigger payload"""
    if not isinstance(data, dict):
        data = {}

    scenario = data.get('scenario', 'normal')
    if scenario not in VALID_SCENARIOS:
        return None, f"Invalid scenario '{scenario}'. Must be one of: {', '.join(sorted(VALID_SCENARIOS))}"

    target_asset_id = data.get('target_asset_id')
    return {
        'scenario': scenario,
        'target_asset_id': str(target_asset_id) if target_asset_id else None
    }, None
