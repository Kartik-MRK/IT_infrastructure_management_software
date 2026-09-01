import os
import sys
from supabase import create_client, Client
from .config import Config

_supabase_client = None

def get_supabase() -> Client:
    """Dynamic getter for Supabase client, honoring unittest.mock patches on app.supabase"""
    app_mod = sys.modules.get('app')
    if app_mod and hasattr(app_mod, 'supabase') and app_mod.supabase is not None:
        return app_mod.supabase
    global _supabase_client
    if _supabase_client is None:
        url = Config.SUPABASE_URL
        key = Config.SUPABASE_SERVICE_KEY
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment")
        _supabase_client = create_client(url, key)
    return _supabase_client

# Direct instance for backward compatibility
class _SupabaseProxy:
    def __getattr__(self, name):
        return getattr(get_supabase(), name)

supabase = _SupabaseProxy()
