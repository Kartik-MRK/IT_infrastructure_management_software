"""Service Layer for Executive Analytics & SRE Command Center"""

from ..repositories.command_center_repository import CommandCenterRepository

class CommandCenterService:
    """Business logic for executive analytics and SRE command center"""

    @staticmethod
    def get_metrics():
        """Fetch unified multi-pillar metrics"""
        try:
            metrics = CommandCenterRepository.get_command_center_metrics()
            return metrics, None, 200
        except Exception as err:
            return None, f"Failed to retrieve executive command center metrics: {str(err)}", 500
