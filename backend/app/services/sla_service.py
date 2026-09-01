"""Service layer for SLA Policies, Timers, and Compliance Logic"""

from typing import Dict, Any, Tuple, Optional
from app.repositories.sla_repository import SLARepository
from app.schemas.sla_schema import validate_sla_policy_payload

class SLAService:
    """Business logic for SLA engine, policy management, and incident response tracking"""

    @staticmethod
    def get_all_policies() -> Tuple[Optional[list], Optional[str], int]:
        """Fetch list of all configured SLA policies"""
        try:
            res = SLARepository.get_all_policies()
            return res.data or [], None, 200
        except Exception as e:
            return None, str(e), 500

    @staticmethod
    def update_policy(policy_id: str, data: Dict[str, Any], user_profile: dict) -> Tuple[Optional[dict], Optional[str], int]:
        """Update SLA policy parameters with role checking"""
        # Role check: only admin or it_admin can adjust SLA targets
        user_role = user_profile.get('role', 'viewer') if user_profile else 'viewer'
        if user_role not in ('admin', 'it_admin'):
            return None, "Forbidden: Only administrators can modify SLA policies", 403

        cleaned, err = validate_sla_policy_payload(data)
        if err:
            return None, err, 400

        try:
            existing = SLARepository.get_policy_by_id(policy_id)
            if not existing.data:
                return None, f"SLA Policy with ID '{policy_id}' not found", 404

            res = SLARepository.update_policy(policy_id, cleaned)
            updated = res.data[0] if res.data else None
            return updated, None, 200
        except Exception as e:
            return None, str(e), 500

    @staticmethod
    def acknowledge_incident(incident_id: str, responder_id: str) -> Tuple[Optional[dict], Optional[str], int]:
        """Record initial response time and check response SLA compliance"""
        try:
            updated, err = SLARepository.record_first_response(incident_id, responder_id)
            if err == "Incident not found":
                return None, err, 404
            if err == "Already acknowledged":
                return updated, "Incident has already been acknowledged", 200
            if not updated:
                return None, "Failed to record response timestamp", 500
            return updated, None, 200
        except Exception as e:
            return None, str(e), 500

    @staticmethod
    def get_sla_compliance_summary() -> Tuple[Optional[dict], Optional[str], int]:
        """Retrieve organization-wide SLA compliance scorecard"""
        try:
            summary = SLARepository.get_sla_compliance_summary()
            return summary, None, 200
        except Exception as e:
            return None, str(e), 500
