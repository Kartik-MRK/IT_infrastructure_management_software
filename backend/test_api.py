"""
Test backend API endpoints
"""
import requests
import os
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = "http://localhost:5000"

print("=" * 60)
print("TESTING BACKEND API ENDPOINTS")
print("=" * 60)

# First, we need to get a valid JWT token
# For testing, let's check if the endpoints are accessible

print("\n1. Testing /api/assets/summary (without auth - should fail):")
response = requests.get(f"{BACKEND_URL}/api/assets/summary")
print(f"   Status: {response.status_code}")
print(f"   Response: {response.text[:200]}")

print("\n2. Testing if backend is running:")
try:
    response = requests.get(f"{BACKEND_URL}/")
    print(f"   Backend is running! Status: {response.status_code}")
except Exception as e:
    print(f"   ❌ Backend not accessible: {e}")

print("\n" + "=" * 60)
print("NOTE: API endpoints require JWT authentication")
print("To test properly, you need to:")
print("1. Open the frontend in browser: http://localhost:5174")
print("2. Login with your credentials")
print("3. Open browser DevTools (F12)")
print("4. Go to Console tab")
print("5. Check for any error messages")
print("=" * 60)
