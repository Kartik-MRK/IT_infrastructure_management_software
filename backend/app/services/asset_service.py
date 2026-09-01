"""Asset Service Business Logic"""

from ..repositories.asset_repository import AssetRepository
from ..repositories.incident_repository import IncidentRepository
from ..schemas.asset_schema import validate_asset_payload

class AssetService:
    """Business logic for asset management and metrics"""
    
    @staticmethod
    def get_all_assets():
        response = AssetRepository.get_all()
        assets = response.data or []
        return assets
        
    @staticmethod
    def get_asset_by_id(asset_id):
        response = AssetRepository.get_by_id(asset_id)
        return response.data
        
    @staticmethod
    def create_asset(raw_data, current_user_id):
        cleaned, error = validate_asset_payload(raw_data, is_update=False)
        if error:
            return None, error
            
        cleaned['created_by'] = current_user_id
        response = AssetRepository.create(cleaned)
        
        if response.data and len(response.data) > 0:
            return response.data[0], None
        return None, "Failed to create asset in database"
        
    @staticmethod
    def update_asset(asset_id, raw_data, current_user):
        # 1. Fetch existing asset
        existing_res = AssetRepository.get_by_id(asset_id)
        if not existing_res.data:
            return None, "Asset not found", 404
            
        existing = existing_res.data
        
        # 2. Check permissions: Operator can only edit assets they created
        if current_user.get('role') == 'operator' and existing.get('created_by') != current_user.get('id'):
            return None, "Operators can only edit assets they created", 403
            
        # 3. Clean payload
        cleaned, error = validate_asset_payload(raw_data, is_update=True)
        if error:
            return None, error, 400
            
        # Empty payload check
        if not cleaned:
            return None, "No valid fields to update", 400
            
        # Exclude created_by to prevent tampering
        cleaned.pop('created_by', None)
        
        response = AssetRepository.update(asset_id, cleaned)
        if response.data and len(response.data) > 0:
            return response.data[0], None, 200
        return None, "Failed to update asset", 500
        
    @staticmethod
    def delete_asset(asset_id, current_user):
        existing_res = AssetRepository.get_by_id(asset_id)
        if not existing_res.data:
            return False, "Asset not found", 404
            
        response = AssetRepository.delete(asset_id)
        return True, "Asset deleted successfully", 200
        
    @staticmethod
    def get_summary():
        total, by_status, by_type = AssetRepository.get_counts_by_status_and_type()
        open_incidents, critical_incidents = IncidentRepository.get_summary_counts()
        
        return {
            'total': total,
            'by_status': by_status,
            'by_type': by_type,
            'incidents': {
                'open': open_incidents,
                'critical': critical_incidents
            }
        }
        
    @staticmethod
    def get_latest_metrics(asset_id):
        res = AssetRepository.get_latest_metrics(asset_id)
        if res.data and len(res.data) > 0:
            return res.data[0]
        return None

    @staticmethod
    def bulk_update_status(asset_ids: list, new_status: str):
        """Update status of multiple assets in batch"""
        if not asset_ids or not isinstance(asset_ids, list):
            return None, "asset_ids list is required", 400
        valid_statuses = {'active', 'in_use', 'maintenance', 'retired', 'damaged'}
        if new_status not in valid_statuses:
            return None, f"Invalid status '{new_status}'. Must be one of: {', '.join(sorted(valid_statuses))}", 400
        
        try:
            res = AssetRepository.bulk_update_status(asset_ids, new_status)
            return {'updated_count': len(asset_ids), 'status': new_status}, None, 200
        except Exception as e:
            return None, str(e), 500

    @staticmethod
    def bulk_delete(asset_ids: list):
        """Batch delete multiple assets"""
        if not asset_ids or not isinstance(asset_ids, list):
            return None, "asset_ids list is required", 400

        try:
            res = AssetRepository.bulk_delete(asset_ids)
            return {'deleted_count': len(asset_ids)}, None, 200
        except Exception as e:
            return None, str(e), 500

