"""Service Layer for Telemetry Ingestion, Outlier Detection, and Chaos Simulation"""

import random
from ..schemas.telemetry_schema import validate_telemetry_payload, validate_simulation_payload
from ..repositories.telemetry_repository import TelemetryRepository

class TelemetryService:
    """Encapsulates business logic for telemetry processing, outlier detection, and chaos generation"""

    @staticmethod
    def ingest_metric(asset_id: str, payload: dict, auto_incident: bool = True):
        """Validate payload and ingest metric through PostgreSQL anomaly evaluation engine"""
        cleaned, error = validate_telemetry_payload(payload)
        if error:
            return None, error, 400

        try:
            result = TelemetryRepository.ingest_and_evaluate(asset_id, cleaned, auto_incident)
            return result, None, 201
        except Exception as err:
            return None, f"Failed to ingest telemetry: {str(err)}", 500

    @staticmethod
    def get_asset_history(asset_id: str, limit: int = 30):
        """Fetch historical time-series samples for sparklines"""
        try:
            history = TelemetryRepository.get_history(asset_id, limit)
            return history, None, 200
        except Exception as err:
            return None, f"Failed to retrieve telemetry history: {str(err)}", 500

    @staticmethod
    def get_system_summary():
        """Fetch system-wide anomaly statistics and active breaches"""
        try:
            summary = TelemetryRepository.get_system_summary()
            return summary, None, 200
        except Exception as err:
            return None, f"Failed to retrieve anomaly summary: {str(err)}", 500

    @staticmethod
    def simulate_telemetry_tick(payload: dict):
        """Execute a synthetic simulation step across active assets with optional chaos scenario"""
        cleaned, error = validate_simulation_payload(payload or {})
        if error:
            return None, error, 400

        scenario = cleaned['scenario']
        target_asset_id = cleaned.get('target_asset_id')

        try:
            active_assets = TelemetryRepository.get_active_assets()
            if not active_assets:
                return {'simulated_count': 0, 'results': []}, None, 200

            results = []
            for asset in active_assets:
                asset_id = asset['id']
                asset_type = asset.get('type', 'hardware')
                is_target = (target_asset_id == asset_id) or (target_asset_id is None and scenario != 'normal')

                # Base synthetic values with subtle natural gaussian variation
                if asset_type == 'hardware':
                    base_cpu = 35.0 + random.uniform(-4.0, 4.0)
                    base_mem = 60.0 + random.uniform(-3.0, 3.0)
                    base_disk = 52.0 + random.uniform(-1.0, 1.0)
                    base_lat = 3.5 + random.uniform(-1.0, 1.0)
                    base_err = 0.0
                    base_bw = 120.0 + random.uniform(-20.0, 30.0)
                elif asset_type == 'network':
                    base_cpu = 22.0 + random.uniform(-3.0, 3.0)
                    base_mem = 42.0 + random.uniform(-2.0, 2.0)
                    base_disk = 30.0
                    base_lat = 1.8 + random.uniform(-0.5, 0.8)
                    base_err = 0.0
                    base_bw = 450.0 + random.uniform(-50.0, 80.0)
                else: # software / cloud
                    base_cpu = 18.0 + random.uniform(-2.0, 2.0)
                    base_mem = 32.0 + random.uniform(-2.0, 2.0)
                    base_disk = 40.0
                    base_lat = 4.2 + random.uniform(-0.8, 1.2)
                    base_err = 0.0
                    base_bw = 85.0 + random.uniform(-15.0, 20.0)

                # Inject Chaos Scenarios if target asset
                if is_target:
                    if scenario == 'cpu_spike':
                        base_cpu = round(random.uniform(96.5, 99.2), 2)
                    elif scenario == 'memory_leak':
                        base_mem = round(random.uniform(93.8, 97.5), 2)
                    elif scenario == 'ddos_surge':
                        base_bw = round(random.uniform(920.0, 1200.0), 2)
                        base_lat = round(random.uniform(180.0, 350.0), 2)
                        base_err = round(random.uniform(12.5, 24.0), 2)
                        base_cpu = round(random.uniform(88.0, 94.0), 2)
                    elif scenario == 'disk_exhaustion':
                        base_disk = round(random.uniform(97.0, 99.5), 2)

                metric_sample = {
                    'cpu_usage': round(min(100.0, max(0.0, base_cpu)), 2),
                    'memory_usage': round(min(100.0, max(0.0, base_mem)), 2),
                    'disk_usage': round(min(100.0, max(0.0, base_disk)), 2),
                    'latency_ms': round(max(0.0, base_lat), 2),
                    'error_rate_percent': round(min(100.0, max(0.0, base_err)), 2),
                    'bandwidth_usage_mbps': round(max(0.0, base_bw), 2)
                }

                # Evaluate metric
                eval_res = TelemetryRepository.ingest_and_evaluate(asset_id, metric_sample, auto_incident=True)
                results.append({
                    'asset_id': asset_id,
                    'asset_name': asset.get('name'),
                    'metrics': metric_sample,
                    'evaluation': eval_res
                })

            return {
                'simulated_count': len(results),
                'scenario': scenario,
                'results': results
            }, None, 200
        except Exception as err:
            return None, f"Failed to execute simulation: {str(err)}", 500
