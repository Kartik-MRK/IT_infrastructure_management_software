"""Alert and Activity Aggregation Service"""

from ..repositories.asset_repository import AssetRepository
from ..repositories.incident_repository import IncidentRepository

class AlertService:
    """Aggregates system health alerts and activity stream"""
    
    @staticmethod
    def get_system_alerts():
        critical_metrics_res = AssetRepository.get_critical_metrics(limit=10)
        warning_metrics_res = AssetRepository.get_warning_metrics(limit=5)
        problematic_assets_res = AssetRepository.get_problematic_assets()
        
        alerts = []
        
        # 1. Process critical metrics
        if critical_metrics_res.data:
            for metric in critical_metrics_res.data:
                asset_data = metric.get('asset')
                if asset_data:
                    alert = {
                        'id': metric['id'],
                        'severity': 'critical',
                        'asset_id': metric['asset_id'],
                        'asset_name': asset_data.get('name', 'Unknown'),
                        'asset_type': asset_data.get('type', 'unknown'),
                        'timestamp': metric['last_updated']
                    }
                    
                    asset_type = asset_data.get('type')
                    if asset_type == 'hardware':
                        issues = []
                        if metric.get('cpu_usage', 0) > 90:
                            issues.append(f"CPU: {metric.get('cpu_usage', 0):.1f}%")
                        if metric.get('memory_usage', 0) > 90:
                            issues.append(f"Memory: {metric.get('memory_usage', 0):.1f}%")
                        if metric.get('temperature', 0) > 75:
                            issues.append(f"Temp: {metric.get('temperature', 0):.1f}°C")
                        if metric.get('disk_usage', 0) > 80:
                            issues.append(f"Disk: {metric.get('disk_usage', 0):.1f}%")
                        alert['message'] = f"Critical - {', '.join(issues)}" if issues else "Hardware metrics critical"
                    elif asset_type == 'software':
                        alert['message'] = f"Software not operational: {metric.get('last_error', 'Unknown error')}"
                    elif asset_type == 'network':
                        alert['message'] = f"High packet loss: {metric.get('packet_loss_percent', 0):.2f}%"
                    elif asset_type == 'infrastructure':
                        alert['message'] = f"Service {metric.get('service_status', 'unknown')}"
                    elif asset_type == 'peripherals':
                        issues = []
                        conn_status = metric.get('connection_status', '')
                        print_status = metric.get('print_status', '')
                        if conn_status == 'disconnected':
                            issues.append("Device Disconnected")
                        elif conn_status == 'intermittent':
                            issues.append("Connection Intermittent")
                        if print_status == 'offline':
                            issues.append("Offline")
                        elif print_status == 'paper_jam':
                            issues.append("Paper Jam")
                        elif print_status == 'error':
                            issues.append("Device Error")
                        elif print_status == 'low_toner':
                            issues.append("Low Toner")
                        if metric.get('peripheral_error'):
                            issues.append(metric.get('peripheral_error'))
                        alert['message'] = f"Peripheral Issue - {', '.join(issues)}" if issues else "Peripheral device critical"
                    else:
                        alert['message'] = "Asset health critical"
                        
                    alerts.append(alert)
                    
        # 2. Process warning metrics
        if warning_metrics_res.data:
            for metric in warning_metrics_res.data:
                asset_data = metric.get('asset')
                if asset_data:
                    alerts.append({
                        'id': metric['id'],
                        'severity': 'warning',
                        'asset_id': metric['asset_id'],
                        'asset_name': asset_data.get('name', 'Unknown'),
                        'asset_type': asset_data.get('type', 'unknown'),
                        'message': "Asset showing warning signs",
                        'timestamp': metric['last_updated']
                    })
                    
        # 3. Process problematic assets
        if problematic_assets_res.data:
            for asset in problematic_assets_res.data:
                alerts.append({
                    'id': asset['id'],
                    'severity': 'warning',
                    'asset_id': asset['id'],
                    'asset_name': asset['name'],
                    'asset_type': asset['type'],
                    'message': f"Asset status: {asset['status']}",
                    'timestamp': asset.get('updated_at') or asset.get('created_at')
                })
                
        return alerts
        
    @staticmethod
    def get_live_activities(limit=8):
        activities = []
        
        # 1. Fetch recent incidents
        incidents_res = IncidentRepository.get_recent(limit=5)
        if incidents_res.data:
            for inc in incidents_res.data:
                reporter_name = inc.get('reporter', {}).get('full_name') if isinstance(inc.get('reporter'), dict) else None
                asset_name = inc.get('asset', {}).get('name') if isinstance(inc.get('asset'), dict) else None
                activities.append({
                    'id': f"inc_{inc['id']}",
                    'type': 'incident',
                    'title': inc['title'],
                    'severity': inc['severity'],
                    'status': inc['status'],
                    'description': f"Incident reported by {reporter_name or 'User'}" + (f" on {asset_name}" if asset_name else ""),
                    'timestamp': inc['created_at'],
                    'link': '/incidents'
                })
                
        # 2. Fetch recent assets
        assets_res = AssetRepository.get_recent(limit=5)
        if assets_res.data:
            for asset in assets_res.data:
                creator_name = asset.get('creator', {}).get('full_name') if isinstance(asset.get('creator'), dict) else None
                activities.append({
                    'id': f"asset_{asset['id']}",
                    'type': 'asset',
                    'title': asset['name'],
                    'severity': 'info',
                    'status': asset['status'],
                    'description': f"New {asset['type']} asset added by {creator_name or 'Admin'}",
                    'timestamp': asset['created_at'],
                    'link': f"/assets/{asset['id']}"
                })
                
        # Sort chronologically descending
        activities.sort(key=lambda x: x.get('timestamp') or '', reverse=True)
        return activities[:limit]
