"""
Quick Diagnostic Script - Check Setup Status
---------------------------------------------
This script checks if everything is set up correctly.
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

print("="*60)
print("ITIMS SETUP DIAGNOSTIC")
print("="*60)

# Check 1: Environment Variables
print("\n1. Checking Environment Variables...")
if SUPABASE_URL:
    print(f"   ✓ SUPABASE_URL: {SUPABASE_URL}")
else:
    print("   ✗ SUPABASE_URL not found!")
    
if SUPABASE_SERVICE_KEY:
    print(f"   ✓ SUPABASE_SERVICE_KEY: {SUPABASE_SERVICE_KEY[:20]}...")
else:
    print("   ✗ SUPABASE_SERVICE_KEY not found!")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("\n❌ Missing environment variables. Please check your .env file.")
    sys.exit(1)

# Check 2: Supabase Connection
print("\n2. Testing Supabase Connection...")
try:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("   ✓ Successfully connected to Supabase")
except Exception as e:
    print(f"   ✗ Failed to connect: {e}")
    sys.exit(1)

# Check 3: Assets Table
print("\n3. Checking Assets Table...")
try:
    assets_response = supabase.table('assets').select('id, name, type').execute()
    asset_count = len(assets_response.data) if assets_response.data else 0
    print(f"   ✓ Assets table exists")
    print(f"   ✓ Found {asset_count} assets")
    
    if asset_count > 0:
        print("\n   Assets in database:")
        for asset in assets_response.data[:5]:  # Show first 5
            print(f"   - {asset['name']} ({asset['type']})")
        if asset_count > 5:
            print(f"   ... and {asset_count - 5} more")
    else:
        print("   ⚠ No assets found. Please create some assets first!")
        
except Exception as e:
    print(f"   ✗ Error accessing assets table: {e}")
    print("   → Make sure you've run CREATE_ASSETS_TABLE.sql")

# Check 4: Asset Metrics Table
print("\n4. Checking Asset Metrics Table...")
try:
    metrics_response = supabase.table('asset_metrics').select('id, asset_id').execute()
    metrics_count = len(metrics_response.data) if metrics_response.data else 0
    print(f"   ✓ Asset_metrics table exists")
    print(f"   ✓ Found {metrics_count} metric records")
    
    if metrics_count == 0:
        print("   ⚠ No metrics found!")
        print("   → Please run simulate_metrics.py to generate metrics")
    else:
        print(f"   ✓ Metrics are being generated!")
        
except Exception as e:
    print(f"   ✗ Error accessing asset_metrics table: {e}")
    print("   → You need to run CREATE_ASSET_METRICS_TABLE.sql in Supabase!")
    print("\n   Steps to fix:")
    print("   1. Open Supabase Dashboard → SQL Editor")
    print("   2. Create a new query")
    print("   3. Copy/paste content from CREATE_ASSET_METRICS_TABLE.sql")
    print("   4. Click RUN")

# Check 5: Test Metrics Query
print("\n5. Testing Metrics Query...")
try:
    if asset_count > 0:
        test_asset_id = assets_response.data[0]['id']
        test_metrics = supabase.table('asset_metrics').select('*').eq('asset_id', test_asset_id).execute()
        
        if test_metrics.data and len(test_metrics.data) > 0:
            print(f"   ✓ Successfully retrieved metrics for asset")
            metric = test_metrics.data[0]
            print(f"   - Health Status: {metric.get('health_status', 'N/A')}")
            print(f"   - Last Updated: {metric.get('last_updated', 'N/A')}")
        else:
            print(f"   ⚠ No metrics found for test asset")
            print("   → Run simulate_metrics.py to generate metrics")
except Exception as e:
    print(f"   ✗ Error testing metrics query: {e}")

# Summary
print("\n" + "="*60)
print("SUMMARY")
print("="*60)

issues = []
if asset_count == 0:
    issues.append("No assets in database - Create some assets first")
if metrics_count == 0:
    issues.append("No metrics generated - Run simulate_metrics.py")

if len(issues) == 0:
    print("✅ Everything looks good!")
    print("\nNext steps:")
    print("1. Make sure Flask backend is running: python app.py")
    print("2. Make sure frontend is running: npm run dev")
    print("3. Make sure simulator is running: python simulate_metrics.py")
    print("4. Open http://localhost:5173 in your browser")
else:
    print("⚠️  Issues found:")
    for i, issue in enumerate(issues, 1):
        print(f"{i}. {issue}")
    print("\nResolve these issues and run this diagnostic again.")

print("="*60)
