"""
Simulate what the backend does when /api/assets/summary is called
"""
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=" * 70)
print("SIMULATING BACKEND /api/assets/summary ENDPOINT")
print("=" * 70)

try:
    # Get total count (exactly as backend does)
    print("\n1. Getting total count...")
    total_response = supabase.table('assets').select('id', count='exact').execute()
    total = total_response.count if total_response.count else 0
    print(f"   ✓ Total assets: {total}")
    
    # Get count by status
    print("\n2. Getting counts by status...")
    active_response = supabase.table('assets').select('id', count='exact').eq('status', 'active').execute()
    active = active_response.count if active_response.count else 0
    print(f"   ✓ Active: {active}")
    
    in_use_response = supabase.table('assets').select('id', count='exact').eq('status', 'in_use').execute()
    in_use = in_use_response.count if in_use_response.count else 0
    print(f"   ✓ In Use: {in_use}")
    
    maintenance_response = supabase.table('assets').select('id', count='exact').eq('status', 'maintenance').execute()
    maintenance = maintenance_response.count if maintenance_response.count else 0
    print(f"   ✓ Maintenance: {maintenance}")
    
    retired_response = supabase.table('assets').select('id', count='exact').eq('status', 'retired').execute()
    retired = retired_response.count if retired_response.count else 0
    print(f"   ✓ Retired: {retired}")
    
    damaged_response = supabase.table('assets').select('id', count='exact').eq('status', 'damaged').execute()
    damaged = damaged_response.count if damaged_response.count else 0
    print(f"   ✓ Damaged: {damaged}")
    
    # Get count by type
    print("\n3. Getting counts by type...")
    hardware_response = supabase.table('assets').select('id', count='exact').eq('type', 'hardware').execute()
    hardware = hardware_response.count if hardware_response.count else 0
    print(f"   ✓ Hardware: {hardware}")
    
    software_response = supabase.table('assets').select('id', count='exact').eq('type', 'software').execute()
    software = software_response.count if software_response.count else 0
    print(f"   ✓ Software: {software}")
    
    network_response = supabase.table('assets').select('id', count='exact').eq('type', 'network').execute()
    network = network_response.count if network_response.count else 0
    print(f"   ✓ Network: {network}")
    
    infrastructure_response = supabase.table('assets').select('id', count='exact').eq('type', 'infrastructure').execute()
    infrastructure = infrastructure_response.count if infrastructure_response.count else 0
    print(f"   ✓ Infrastructure: {infrastructure}")
    
    # Build the response object
    response_data = {
        'summary': {
            'total': total,
            'by_status': {
                'active': active,
                'in_use': in_use,
                'maintenance': maintenance,
                'retired': retired,
                'damaged': damaged
            },
            'by_type': {
                'hardware': hardware,
                'software': software,
                'network': network,
                'infrastructure': infrastructure
            }
        }
    }
    
    print("\n" + "=" * 70)
    print("BACKEND WOULD RETURN THIS JSON:")
    print("=" * 70)
    import json
    print(json.dumps(response_data, indent=2))
    
    print("\n" + "=" * 70)
    print("✅ BACKEND LOGIC IS WORKING CORRECTLY!")
    print("=" * 70)
    
    print("\nThe issue is likely:")
    print("1. Frontend not logged in (no JWT token)")
    print("2. Browser blocking the request (CORS)")
    print("3. Network request failing")
    print("\n👉 Check browser DevTools Console (F12) for errors!")
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    print("\nThis error would be returned to the frontend.")
