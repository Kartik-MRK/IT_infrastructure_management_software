"""Incident Service Business Logic"""

from datetime import datetime, timezone
from ..repositories.incident_repository import IncidentRepository
from ..repositories.user_repository import UserRepository
from ..schemas.incident_schema import validate_incident_payload
from ..core.mail import send_critical_incident_email

class IncidentService:
    """Business logic for incident lifecycle and alerting"""
    
    @staticmethod
    def get_all(status=None, severity=None, asset_id=None):
        response = IncidentRepository.get_all(status, severity, asset_id)
        return response.data or []
        
    @staticmethod
    def get_by_id(incident_id):
        response = IncidentRepository.get_by_id(incident_id)
        return response.data
        
    @staticmethod
    def create_incident(raw_data, current_user):
        cleaned, error = validate_incident_payload(raw_data, is_update=False)
        if error:
            return None, error, 400
            
        cleaned['reported_by'] = current_user['id']
        cleaned['status'] = cleaned.get('status') or 'open'
        
        response = IncidentRepository.create(cleaned)
        if not response.data or len(response.data) == 0:
            return None, "Failed to create incident", 500
            
        incident = response.data[0]
        
        # Send critical incident email if applicable
        if incident.get('severity') == 'critical':
            try:
                send_critical_incident_email(incident, current_user)
            except Exception as e:
                print(f"⚠️ Failed to send critical email: {e}")
                
        return incident, None, 201
        
    @staticmethod
    def update_incident(incident_id, raw_data, current_user):
        existing_res = IncidentRepository.get_by_id(incident_id)
        if not existing_res.data:
            return None, "Incident not found", 404
            
        existing = existing_res.data
        
        # Permissions: admin, reporter, or assignee can update
        can_update = (
            current_user.get('role') == 'admin' or
            existing.get('reported_by') == current_user.get('id') or
            existing.get('assigned_to') == current_user.get('id')
        )
        if not can_update:
            return None, "You do not have permission to update this incident", 403
                
        cleaned, error = validate_incident_payload(raw_data, is_update=True)
        if error:
            return None, error, 400
            
        if not cleaned:
            return None, "No valid fields to update", 400
            
        # If resolving, set resolved_at and resolved_by
        if cleaned.get('status') in ['resolved', 'closed'] and existing.get('status') not in ['resolved', 'closed']:
            cleaned['resolved_at'] = datetime.now(timezone.utc).isoformat()
            cleaned['resolved_by'] = current_user['id']
        elif cleaned.get('status') and cleaned['status'] not in ['resolved', 'closed']:
            cleaned['resolved_at'] = None
            cleaned['resolved_by'] = None
            
        response = IncidentRepository.update(incident_id, cleaned)
        if response.data and len(response.data) > 0:
            return response.data[0], None, 200
        return None, "Failed to update incident", 500
        
    @staticmethod
    def assign_incident(incident_id, assigned_to_id, current_user):
        existing_res = IncidentRepository.get_by_id(incident_id)
        if not existing_res.data:
            return None, "Incident not found", 404
            
        update_data = {
            'assigned_to': assigned_to_id,
            'status': 'in_progress' if existing_res.data.get('status') == 'open' else existing_res.data.get('status')
        }
        
        response = IncidentRepository.update(incident_id, update_data)
        if response.data and len(response.data) > 0:
            return response.data[0], None, 200
        return None, "Failed to assign incident", 500
        
    @staticmethod
    def update_status(incident_id, new_status, resolution_notes, current_user):
        existing_res = IncidentRepository.get_by_id(incident_id)
        if not existing_res.data:
            return None, "Incident not found", 404
            
        update_data = {'status': new_status}
        if resolution_notes is not None:
            update_data['resolution_notes'] = str(resolution_notes).strip() or None
            
        if new_status in ['resolved', 'closed']:
            update_data['resolved_at'] = datetime.now(timezone.utc).isoformat()
            update_data['resolved_by'] = current_user['id']
            
        response = IncidentRepository.update(incident_id, update_data)
        if response.data and len(response.data) > 0:
            return response.data[0], None, 200
        return None, "Failed to update incident status", 500
        
    @staticmethod
    def escalate_incident(incident_id, priority_boost, current_user):
        existing_res = IncidentRepository.get_by_id(incident_id)
        if not existing_res.data:
            return None, "Incident not found", 404
            
        current_priority = existing_res.data.get('priority') or 5
        new_priority = min(10, current_priority + priority_boost)
        
        update_data = {
            'priority': new_priority,
            'severity': 'critical' if new_priority >= 8 else existing_res.data.get('severity')
        }
        
        response = IncidentRepository.update(incident_id, update_data)
        if response.data and len(response.data) > 0:
            return response.data[0], None, 200
        return None, "Failed to escalate incident", 500
        
    @staticmethod
    def delete_incident(incident_id, current_user):
        existing_res = IncidentRepository.get_by_id(incident_id)
        if not existing_res.data:
            return False, "Incident not found", 404
            
        IncidentRepository.delete(incident_id)
        return True, "Incident deleted successfully", 200
