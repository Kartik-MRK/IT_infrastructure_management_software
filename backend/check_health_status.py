"""
Quick script to check if health_status is being set in asset_metrics
"""
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("Checking asset_metrics for health_status field...")
print("="*70)

# Get all metrics with health_status
response = supabase.table('asset_metrics').select('asset_id, cpu_usage, memory_usage, temperature, health_status, assets(name, type)').limit(10).execute()

if response.data:
    for metric in response.data:
        asset_info = metric.get('assets', {})
        asset_name = asset_info.get('name', 'Unknown') if isinstance(asset_info, dict) else 'Unknown'
        asset_type = asset_info.get('type', 'unknown') if isinstance(asset_info, dict) else 'unknown'
        health = metric.get('health_status', 'MISSING!')
        
        print(f"{asset_name:30} [{asset_type:12}] health_status: {health}")
        if asset_type == 'hardware':
            print(f"   CPU: {metric.get('cpu_usage')}%  Memory: {metric.get('memory_usage')}%  Temp: {metric.get('temperature')}°C")
else:
    print("No metrics found!")

print("\n" + "="*70)
print("Now checking ONLY critical health_status...")
print("="*70)

critical = supabase.table('asset_metrics').select('*, assets(name, type)').eq('health_status', 'critical').execute()

print(f"Found {len(critical.data) if critical.data else 0} critical metrics")
if critical.data:
    for metric in critical.data:
        asset_info = metric.get('assets', {})
        asset_name = asset_info.get('name', 'Unknown') if isinstance(asset_info, dict) else 'Unknown'
        asset_type = asset_info.get('type', 'unknown') if isinstance(asset_info, dict) else 'unknown'
        print(f"  - {asset_name} [{asset_type}]")
