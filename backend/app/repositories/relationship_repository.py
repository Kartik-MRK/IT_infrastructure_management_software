"""Asset Relationship Repository for CMDB & Dependency Graph Access"""

from ..core.database import get_supabase

class RelationshipRepository:
    """Encapsulates all database operations on asset_relationships table and graph functions"""
    
    @staticmethod
    def get_for_asset(asset_id):
        """Fetch all relationships where asset is parent or child"""
        supabase = get_supabase()
        
        # Outgoing relationships (asset is parent)
        outgoing = supabase.table('asset_relationships').select('''
            id, relationship_type, description, created_at,
            child:child_asset_id(id, name, type, status, location)
        ''').eq('parent_asset_id', asset_id).execute()
        
        # Incoming relationships (asset is child)
        incoming = supabase.table('asset_relationships').select('''
            id, relationship_type, description, created_at,
            parent:parent_asset_id(id, name, type, status, location)
        ''').eq('child_asset_id', asset_id).execute()
        
        return {
            'outgoing': outgoing.data or [],
            'incoming': incoming.data or []
        }

    @staticmethod
    def get_all():
        """Fetch all relationships across the entire infrastructure"""
        supabase = get_supabase()
        return supabase.table('asset_relationships').select('''
            id, parent_asset_id, child_asset_id, relationship_type, description, created_at,
            parent:parent_asset_id(id, name, type, status),
            child:child_asset_id(id, name, type, status)
        ''').execute()
        
    @staticmethod
    def create(parent_asset_id, child_asset_id, relationship_type, description=None, user_id=None):
        """Insert a new dependency relationship"""
        supabase = get_supabase()
        data = {
            'parent_asset_id': parent_asset_id,
            'child_asset_id': child_asset_id,
            'relationship_type': relationship_type,
            'description': description,
            'created_by': user_id
        }
        return supabase.table('asset_relationships').insert(data).execute()
        
    @staticmethod
    def delete(relationship_id):
        """Delete an asset relationship by ID"""
        supabase = get_supabase()
        return supabase.table('asset_relationships').delete().eq('id', relationship_id).execute()
        
    @staticmethod
    def calculate_blast_radius(asset_id, max_depth=5):
        """Invoke PostgreSQL recursive CTE to compute downstream blast radius"""
        supabase = get_supabase()
        try:
            rpc_res = supabase.rpc('calculate_blast_radius', {
                'root_asset_id': str(asset_id),
                'max_depth': max_depth
            }).execute()
            return rpc_res.data or []
        except Exception as e:
            print(f"⚠️ calculate_blast_radius RPC error: {e}")
            return []
