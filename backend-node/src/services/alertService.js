/**
 * Alert and Activity Aggregation Service
 */

import { AssetRepository } from '../repositories/assetRepository.js';
import { IncidentRepository } from '../repositories/incidentRepository.js';

export class AlertService {
  /**
   * Aggregates system health alerts across critical/warning metrics and damaged assets
   */
  static async getSystemAlerts() {
    const criticalMetricsRes = await AssetRepository.getCriticalMetrics(10);
    const warningMetricsRes = await AssetRepository.getWarningMetrics(5);
    const problematicAssetsRes = await AssetRepository.getProblematicAssets();

    const criticalMetrics = criticalMetricsRes?.data || criticalMetricsRes || [];
    const warningMetrics = warningMetricsRes?.data || warningMetricsRes || [];
    const problematicAssets = problematicAssetsRes?.data || problematicAssetsRes || [];

    const alerts = [];

    // 1. Process critical metrics
    if (criticalMetrics && criticalMetrics.length > 0) {
      for (const metric of criticalMetrics) {
        const assetData = metric.asset;
        if (assetData) {
          const alert = {
            id: metric.id,
            severity: 'critical',
            asset_id: metric.asset_id,
            asset_name: assetData.name || 'Unknown',
            asset_type: assetData.type || 'unknown',
            timestamp: metric.last_updated,
          };

          const assetType = assetData.type;
          if (assetType === 'hardware') {
            const issues = [];
            if ((metric.cpu_usage || 0) > 90) issues.push(`CPU: ${Number(metric.cpu_usage).toFixed(1)}%`);
            if ((metric.memory_usage || 0) > 90) issues.push(`Memory: ${Number(metric.memory_usage).toFixed(1)}%`);
            if ((metric.temperature || 0) > 75) issues.push(`Temp: ${Number(metric.temperature).toFixed(1)}°C`);
            if ((metric.disk_usage || 0) > 80) issues.push(`Disk: ${Number(metric.disk_usage).toFixed(1)}%`);
            alert.message = issues.length > 0 ? `Critical - ${issues.join(', ')}` : 'Hardware metrics critical';
          } else if (assetType === 'software') {
            alert.message = `Software not operational: ${metric.last_error || 'Unknown error'}`;
          } else if (assetType === 'network') {
            alert.message = `High packet loss: ${Number(metric.packet_loss_percent || 0).toFixed(2)}%`;
          } else if (assetType === 'infrastructure') {
            alert.message = `Service ${metric.service_status || 'unknown'}`;
          } else if (assetType === 'peripherals') {
            const issues = [];
            const connStatus = metric.connection_status || '';
            const printStatus = metric.print_status || '';
            if (connStatus === 'disconnected') issues.push('Device Disconnected');
            else if (connStatus === 'intermittent') issues.push('Connection Intermittent');
            if (printStatus === 'offline') issues.push('Offline');
            else if (printStatus === 'paper_jam') issues.push('Paper Jam');
            else if (printStatus === 'error') issues.push('Device Error');
            else if (printStatus === 'low_toner') issues.push('Low Toner');
            if (metric.peripheral_error) issues.push(metric.peripheral_error);
            alert.message = issues.length > 0 ? `Peripheral Issue - ${issues.join(', ')}` : 'Peripheral device critical';
          } else {
            alert.message = 'Asset health critical';
          }

          alerts.push(alert);
        }
      }
    }

    // 2. Process warning metrics
    if (warningMetrics && warningMetrics.length > 0) {
      for (const metric of warningMetrics) {
        const assetData = metric.asset;
        if (assetData) {
          alerts.push({
            id: metric.id,
            severity: 'warning',
            asset_id: metric.asset_id,
            asset_name: assetData.name || 'Unknown',
            asset_type: assetData.type || 'unknown',
            message: 'Asset showing warning signs',
            timestamp: metric.last_updated,
          });
        }
      }
    }

    // 3. Process problematic assets
    if (problematicAssets && problematicAssets.length > 0) {
      for (const asset of problematicAssets) {
        alerts.push({
          id: asset.id,
          severity: 'warning',
          asset_id: asset.id,
          asset_name: asset.name,
          asset_type: asset.type,
          message: `Asset status: ${asset.status}`,
          timestamp: asset.updated_at || asset.created_at,
        });
      }
    }

    return alerts;
  }

  /**
   * Aggregates live activity stream from recent incidents and assets
   */
  static async getLiveActivities(limit = 8) {
    const activities = [];

    // 1. Fetch recent incidents
    const incidentsRes = await IncidentRepository.getRecent(5);
    const incidents = incidentsRes?.data || incidentsRes || [];

    if (incidents && incidents.length > 0) {
      for (const inc of incidents) {
        const reporterName =
          inc.reporter && typeof inc.reporter === 'object' ? inc.reporter.full_name : null;
        const assetName =
          inc.asset && typeof inc.asset === 'object' ? inc.asset.name : null;

        activities.push({
          id: `inc_${inc.id}`,
          type: 'incident',
          title: inc.title,
          severity: inc.severity,
          status: inc.status,
          description: `Incident reported by ${reporterName || 'User'}${assetName ? ` on ${assetName}` : ''}`,
          timestamp: inc.created_at,
          link: '/incidents',
        });
      }
    }

    // 2. Fetch recent assets
    const assetsRes = await AssetRepository.getRecent(5);
    const assets = assetsRes?.data || assetsRes || [];

    if (assets && assets.length > 0) {
      for (const asset of assets) {
        const creatorName =
          asset.creator && typeof asset.creator === 'object' ? asset.creator.full_name : null;

        activities.push({
          id: `asset_${asset.id}`,
          type: 'asset',
          title: asset.name,
          severity: 'info',
          status: asset.status,
          description: `New ${asset.type} asset added by ${creatorName || 'Admin'}`,
          timestamp: asset.created_at,
          link: `/assets/${asset.id}`,
        });
      }
    }

    // Sort chronologically descending
    activities.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });

    return activities.slice(0, limit);
  }
}
