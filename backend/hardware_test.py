"""
Hardware Critical Metrics Injector - FOR TESTING ONLY
------------------------------------------------------
This script ONLY injects CRITICAL hardware values to test alert system.
It updates hardware assets every 5 seconds with values that WILL trigger alerts.

USE THIS FOR TESTING ALERTS ONLY!

Run: python hardware_test.py
"""

import os
import time
import random
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_hardware_assets():
    """Fetch all hardware assets from database"""
    try:
        response = supabase.table('assets').select('id, name, type').eq('type', 'hardware').execute()
        return response.data
    except Exception as e:
        print(f"Error fetching assets: {e}")
        return []

def generate_critical_hardware_metrics():
    """
    Generate CRITICAL hardware metrics that will DEFINITELY trigger alerts.
    Alternates between different types of critical conditions.
    Returns metrics with health_status calculated based on thresholds.
    """
    scenario = random.randint(1, 4)
    
    if scenario == 1:
        # Critical CPU scenario
        metrics = {
            'cpu_usage': round(random.uniform(91, 98), 2),  # CRITICAL: > 90%
            'memory_usage': round(random.uniform(50, 70), 2),  # Normal
            'disk_usage': round(random.uniform(50, 70), 2),  # Normal
            'temperature': round(random.uniform(50, 60), 2),  # Normal
        }
    elif scenario == 2:
        # Critical Memory scenario
        metrics = {
            'cpu_usage': round(random.uniform(50, 70), 2),  # Normal
            'memory_usage': round(random.uniform(91, 98), 2),  # CRITICAL: > 90%
            'disk_usage': round(random.uniform(50, 70), 2),  # Normal
            'temperature': round(random.uniform(50, 60), 2),  # Normal
        }
    elif scenario == 3:
        # Critical Temperature scenario
        metrics = {
            'cpu_usage': round(random.uniform(50, 70), 2),  # Normal
            'memory_usage': round(random.uniform(50, 70), 2),  # Normal
            'disk_usage': round(random.uniform(50, 70), 2),  # Normal
            'temperature': round(random.uniform(76, 85), 2),  # CRITICAL: > 75°C
        }
    else:
        # EXTREME scenario - Everything critical
        metrics = {
            'cpu_usage': round(random.uniform(92, 98), 2),  # CRITICAL
            'memory_usage': round(random.uniform(92, 98), 2),  # CRITICAL
            'disk_usage': round(random.uniform(85, 95), 2),  # CRITICAL: > 80%
            'temperature': round(random.uniform(78, 85), 2),  # CRITICAL
        }
    
    # Calculate health_status based on thresholds
    cpu = metrics['cpu_usage']
    mem = metrics['memory_usage']
    temp = metrics['temperature']
    disk = metrics['disk_usage']
    
    # Critical thresholds
    if cpu > 90 or mem > 90 or temp > 75 or disk > 80:
        metrics['health_status'] = 'critical'
    elif cpu > 75 or mem > 75 or temp > 65 or disk > 70:
        metrics['health_status'] = 'warning'
    else:
        metrics['health_status'] = 'healthy'
    
    return metrics


def inject_critical_metrics(asset_id, asset_name, metrics):
    """Insert critical metrics for a hardware asset - using same pattern as simulate_metrics.py"""
    try:
        # Check if metrics exist (EXACT same pattern as simulate_metrics.py)
        existing = supabase.table('asset_metrics').select('id').eq('asset_id', asset_id).execute()
        
        metrics_data = {
            'asset_id': asset_id,
            **metrics
        }
        
        # DEBUG: Print what we're sending
        if 'health_status' not in metrics_data:
            print(f"   ⚠️  WARNING: health_status MISSING for {asset_name}!")
        else:
            print(f"   ✓ Sending health_status={metrics_data['health_status']} for {asset_name}")
        
        if existing.data and len(existing.data) > 0:
            # Update existing metrics
            result = supabase.table('asset_metrics').update(metrics_data).eq('asset_id', asset_id).execute()
        else:
            # Insert new metrics
            result = supabase.table('asset_metrics').insert(metrics_data).execute()
        
        return True
    except Exception as e:
        print(f"❌ Error injecting metrics for {asset_name}: {e}")
        return False

def test_cycle():
    """Run one test cycle - inject critical values for all hardware"""
    assets = get_hardware_assets()
    
    if not assets:
        print("❌ No hardware assets found in database!")
        return
    
    print(f"\n{'='*70}")
    print(f"🧪 CRITICAL METRICS INJECTION at {datetime.now().strftime('%H:%M:%S')}")
    print(f"{'='*70}")
    
    critical_count = 0
    
    for asset in assets:
        asset_id = asset['id']
        asset_name = asset['name']
        
        # Generate CRITICAL metrics
        metrics = generate_critical_hardware_metrics()
        
        # Inject into database
        success = inject_critical_metrics(asset_id, asset_name, metrics)
        
        if success:
            # Determine what's critical
            critical_items = []
            if metrics['cpu_usage'] > 90:
                critical_items.append(f"CPU:{metrics['cpu_usage']:.1f}%")
            if metrics['memory_usage'] > 90:
                critical_items.append(f"MEM:{metrics['memory_usage']:.1f}%")
            if metrics['temperature'] > 75:
                critical_items.append(f"TEMP:{metrics['temperature']:.1f}°C")
            if metrics['disk_usage'] > 80:
                critical_items.append(f"DISK:{metrics['disk_usage']:.1f}%")
            
            critical_str = " | ".join(critical_items)
            print(f"🔥 {asset_name:30} | {critical_str}")
            critical_count += 1
        else:
            print(f"❌ {asset_name:30} | FAILED TO INJECT")
    
    print(f"{'─'*70}")
    print(f"✅ Injected {critical_count}/{len(assets)} critical metrics")
    print(f"💡 Open hardware asset pages NOW to see alerts!")
    print(f"{'─'*70}")

def main():
    """Main test loop"""
    print("="*70)
    print("🧪 HARDWARE CRITICAL METRICS TEST INJECTOR")
    print("="*70)
    print("⚠️  WARNING: This script injects ONLY CRITICAL values!")
    print("⚠️  Use this ONLY for testing the alert system.")
    print("="*70)
    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Injection Interval: 5 seconds")
    print(f"Mode: CRITICAL VALUES ONLY")
    print("="*70)
    
    # Test database connection
    print("\n🔍 Testing database connection...")
    try:
        test_assets = get_hardware_assets()
        print(f"✅ Connection successful! Found {len(test_assets)} hardware assets:")
        for asset in test_assets:
            print(f"   - {asset['name']}")
        
        if len(test_assets) == 0:
            print("\n⚠️  WARNING: No hardware assets found!")
            print("   Make sure you have hardware assets in the database.")
            print("   Run CREATE_ASSETS_TABLE.sql to add sample assets.")
            return
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print("\nCheck:")
        print("1. Is backend/.env file present?")
        print("2. Does it have SUPABASE_URL and SUPABASE_SERVICE_KEY?")
        print("3. Are the credentials correct?")
        return
    
    print("\n📋 Instructions:")
    print("1. Start this script")
    print("2. Open a hardware asset page in your browser")
    print("3. Watch the console logs (F12) for threshold checks")
    print("4. Toast alerts should pop up when values cross thresholds")
    print("\nPress Ctrl+C to stop\n")
    
    try:
        cycle_count = 0
        while True:
            cycle_count += 1
            print(f"\n🔄 Cycle #{cycle_count}")
            test_cycle()
            print(f"\n⏳ Waiting 5 seconds before next injection...")
            time.sleep(5)
    except KeyboardInterrupt:
        print("\n\n" + "="*70)
        print("🛑 Test injection stopped by user")
        print(f"📊 Total cycles run: {cycle_count}")
        print("="*70)
    except Exception as e:
        print(f"\n\n❌ Fatal error: {e}")
        print("="*70)

if __name__ == "__main__":
    main()
