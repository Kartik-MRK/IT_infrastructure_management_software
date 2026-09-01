"""Financial Lifecycle & TCO Repository for Database Access"""

from ..core.database import get_supabase

class FinancialRepository:
    """Encapsulates all database operations and stored RPC queries for asset financials & TCO"""

    @staticmethod
    def get_asset_financials(asset_id):
        """Invoke PostgreSQL calculate_asset_financials stored procedure"""
        supabase = get_supabase()
        try:
            rpc_res = supabase.rpc('calculate_asset_financials', {
                'target_asset_id': str(asset_id)
            }).execute()
            if rpc_res.data and len(rpc_res.data) > 0:
                return rpc_res.data[0]
            return None
        except Exception as e:
            print(f"⚠️ calculate_asset_financials RPC error: {e}")
            return None

    @staticmethod
    def get_executive_summary():
        """Invoke PostgreSQL get_executive_financial_summary stored procedure"""
        supabase = get_supabase()
        try:
            rpc_res = supabase.rpc('get_executive_financial_summary').execute()
            if rpc_res.data:
                # Handle single JSONB or list wrapping
                if isinstance(rpc_res.data, list) and len(rpc_res.data) > 0:
                    first = rpc_res.data[0]
                    if isinstance(first, dict) and 'get_executive_financial_summary' in first:
                        return first['get_executive_financial_summary']
                    return first
                return rpc_res.data
            return None
        except Exception as e:
            print(f"⚠️ get_executive_financial_summary RPC error: {e}")
            return None

    @staticmethod
    def get_asset_maintenance_incidents(asset_id):
        """Fetch all maintenance incidents contributing to an asset's OpEx"""
        supabase = get_supabase()
        return supabase.table('incidents').select('''
            id, title, severity, status, maintenance_cost, created_at, resolved_at
        ''').eq('asset_id', asset_id).order('created_at', desc=True).execute()

    @staticmethod
    def get_all_active_assets():
        """Fetch all active assets for forward depreciation budget forecasting"""
        supabase = get_supabase()
        return supabase.table('assets').select('''
            id, name, type, cost, salvage_value, useful_life_years, depreciation_method, purchase_date
        ''').eq('is_active', True).is_('deleted_at', 'null').execute()
