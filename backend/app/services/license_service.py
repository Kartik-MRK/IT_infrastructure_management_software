"""Software License Service for Business Logic & Compliance Calculations"""

from datetime import datetime, date
from ..repositories.license_repository import LicenseRepository
from ..repositories.asset_repository import AssetRepository
from ..schemas.license_schema import validate_license_data, validate_allocation_data

class LicenseService:
    """Service layer for software licensing, seat allocation workflows, and compliance audits"""

    @staticmethod
    def _compute_license_metrics(license_obj):
        """Helper to calculate real-time seat utilization and compliance status"""
        total = license_obj.get('total_seats', 0)
        allocations = license_obj.get('allocations') or []
        allocated_count = len(allocations)
        available_count = max(0, total - allocated_count)
        
        utilization = 100.0 if total == 0 else round((allocated_count / total) * 100, 2)
        
        exp_date_str = license_obj.get('expiration_date')
        days_until_expiry = None
        is_expired = False
        
        if exp_date_str:
            try:
                exp_d = datetime.strptime(str(exp_date_str)[:10], '%Y-%m-%d').date()
                today = date.today()
                delta = (exp_d - today).days
                days_until_expiry = delta
                if delta < 0:
                    is_expired = True
            except Exception:
                pass
                
        if is_expired:
            compliance = 'EXPIRED'
        elif total > 0 and allocated_count > total:
            compliance = 'OVER_ALLOCATED'
        elif total > 0 and (allocated_count / total) >= 0.90:
            compliance = 'WARNING_90_PERCENT'
        else:
            compliance = 'COMPLIANT'
            
        return {
            'allocated_seats': allocated_count,
            'available_seats': available_count,
            'utilization_percent': utilization,
            'days_until_expiration': days_until_expiry,
            'compliance_status': compliance
        }

    @staticmethod
    def get_all_licenses(software_asset_id=None, department_id=None):
        """Fetch all software licenses with computed compliance and seat metrics"""
        res = LicenseRepository.get_all(software_asset_id=software_asset_id, department_id=department_id)
        licenses = res.data or []
        
        for lic in licenses:
            metrics = LicenseService._compute_license_metrics(lic)
            lic.update(metrics)
            
        return licenses

    @staticmethod
    def get_license_by_id(license_id):
        """Fetch a single license with full allocation details"""
        res = LicenseRepository.get_by_id(license_id)
        if not res.data:
            return None
            
        lic = res.data
        metrics = LicenseService._compute_license_metrics(lic)
        lic.update(metrics)
        return lic

    @staticmethod
    def create_license(data, user_id=None):
        """Validate and create a new software license"""
        cleaned, error = validate_license_data(data, is_update=False)
        if error:
            return None, error, 400
            
        # Verify software asset exists
        asset_res = AssetRepository.get_by_id(cleaned['software_asset_id'])
        if not asset_res.data:
            return None, f"Software asset '{cleaned['software_asset_id']}' not found", 404
            
        if asset_res.data.get('type') != 'software':
            return None, f"Asset '{asset_res.data.get('name')}' is of type '{asset_res.data.get('type')}'. Licenses can only be attached to 'software' assets.", 400
            
        cleaned['created_by'] = user_id
        
        try:
            res = LicenseRepository.create(cleaned)
            if res.data and len(res.data) > 0:
                return res.data[0], None, 201
            return None, "Failed to create license", 500
        except Exception as e:
            return None, str(e), 500

    @staticmethod
    def update_license(license_id, data):
        """Update an existing license"""
        cleaned, error = validate_license_data(data, is_update=True)
        if error:
            return None, error, 400
            
        cleaned['updated_at'] = datetime.now().isoformat()
        
        try:
            res = LicenseRepository.update(license_id, cleaned)
            if res.data and len(res.data) > 0:
                return res.data[0], None, 200
            return None, "License not found", 404
        except Exception as e:
            return None, str(e), 500

    @staticmethod
    def delete_license(license_id):
        """Delete a software license"""
        res = LicenseRepository.delete(license_id)
        return True, "License deleted successfully", 200

    @staticmethod
    def allocate_seat(license_id, data):
        """Allocate a license seat to a hardware device or user"""
        cleaned, error = validate_allocation_data(data)
        if error:
            return None, error, 400
            
        lic_res = LicenseRepository.get_by_id(license_id)
        if not lic_res.data:
            return None, "License not found", 404
            
        # Verify hardware asset if provided
        if cleaned.get('allocated_to_asset_id'):
            asset_res = AssetRepository.get_by_id(cleaned['allocated_to_asset_id'])
            if not asset_res.data:
                return None, f"Hardware asset '{cleaned['allocated_to_asset_id']}' not found", 404
                
        cleaned['license_id'] = license_id
        
        try:
            res = LicenseRepository.create_allocation(cleaned)
            if res.data and len(res.data) > 0:
                return res.data[0], None, 201
            return None, "Failed to allocate seat", 500
        except Exception as e:
            err_msg = str(e)
            if "uq_license_asset_alloc" in err_msg or "duplicate key" in err_msg:
                return None, "This hardware asset already has a seat allocated for this license", 409
            return None, err_msg, 500

    @staticmethod
    def reclaim_seat(allocation_id):
        """Reclaim/revoke an allocated license seat"""
        res = LicenseRepository.delete_allocation(allocation_id)
        return True, "License seat reclaimed successfully", 200

    @staticmethod
    def get_compliance_dashboard():
        """Aggregated compliance metrics across all organization software licenses"""
        summary_records = LicenseRepository.get_compliance_summary()
        
        total_licenses = len(summary_records)
        total_seats = sum(r.get('total_seats', 0) for r in summary_records)
        total_allocated = sum(r.get('allocated_seats', 0) for r in summary_records)
        
        compliant_count = sum(1 for r in summary_records if r.get('compliance_status') == 'COMPLIANT')
        warning_count = sum(1 for r in summary_records if r.get('compliance_status') == 'WARNING_90_PERCENT')
        over_allocated_count = sum(1 for r in summary_records if r.get('compliance_status') == 'OVER_ALLOCATED')
        expired_count = sum(1 for r in summary_records if r.get('compliance_status') == 'EXPIRED')
        
        overall_utilization = 0.0
        if total_seats > 0:
            overall_utilization = round((total_allocated / total_seats) * 100, 2)
            
        return {
            'overview': {
                'total_licenses': total_licenses,
                'total_seats': total_seats,
                'total_allocated': total_allocated,
                'available_seats': max(0, total_seats - total_allocated),
                'overall_utilization_percent': overall_utilization
            },
            'compliance_breakdown': {
                'compliant': compliant_count,
                'warning_90_percent': warning_count,
                'over_allocated': over_allocated_count,
                'expired': expired_count
            },
            'licenses': summary_records
        }
