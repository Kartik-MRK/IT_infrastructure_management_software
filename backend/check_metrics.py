"""
Quick diagnostic script to check metrics data
"""
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=" * 60)
print("CHECKING ASSET METRICS DATA")
print("=" * 60)

# Check assets
print("\n1. ASSETS:")
assets = supabase.table('assets').select('id, name, type, status').execute()
print(f"   Total assets: {len(assets.data)}")
for asset in assets.data[:5]:
    print(f"   - {asset['name']} ({asset['type']}) - {asset['status']}")

# Check metrics
print("\n2. ASSET METRICS:")
metrics = supabase.table('asset_metrics').select('asset_id, health_status, last_updated').order('last_updated', desc=True).limit(5).execute()
print(f"   Total metrics records: {len(metrics.data)}")
for metric in metrics.data:
    print(f"   - Asset: {metric['asset_id'][:8]}... | Health: {metric['health_status']} | Updated: {metric['last_updated']}")

# Check specific asset metrics
print("\n3. CHECKING FIRST ASSET DETAILED METRICS:")
if assets.data:
    asset_id = assets.data[0]['id']
    asset_name = assets.data[0]['name']
    asset_type = assets.data[0]['type']
    
    print(f"   Asset: {asset_name} ({asset_id})")
    
    asset_metrics = supabase.table('asset_metrics').select('*').eq('asset_id', asset_id).order('last_updated', desc=True).limit(1).execute()
    
    if asset_metrics.data:
        m = asset_metrics.data[0]
        print(f"   Health Status: {m['health_status']}")
        print(f"   Last Updated: {m['last_updated']}")
        
        if asset_type == 'hardware':
            print(f"   CPU Usage: {m.get('cpu_usage', 'N/A')}%")
            print(f"   Memory Usage: {m.get('memory_usage', 'N/A')}%")
            print(f"   Disk Usage: {m.get('disk_usage', 'N/A')}%")
            print(f"   Temperature: {m.get('temperature', 'N/A')}°C")
        elif asset_type == 'software':
            print(f"   Operational: {m.get('is_operational', 'N/A')}")
            print(f"   Uptime: {m.get('uptime_hours', 'N/A')} hours")
            print(f"   Last Error: {m.get('last_error', 'None')}")
        elif asset_type == 'network':
            print(f"   Bandwidth: {m.get('bandwidth_usage_mbps', 'N/A')} Mbps")
            print(f"   Packet Loss: {m.get('packet_loss_percent', 'N/A')}%")
            print(f"   Latency: {m.get('latency_ms', 'N/A')} ms")
        elif asset_type == 'infrastructure':
            print(f"   Service Status: {m.get('service_status', 'N/A')}")
            print(f"   Response Time: {m.get('response_time_ms', 'N/A')} ms")
            print(f"   Availability: {m.get('availability_percent', 'N/A')}%")
    else:
        print("   ⚠️ No metrics found for this asset!")

print("\n" + "=" * 60)
print("DIAGNOSIS COMPLETE")
print("=" * 60)
