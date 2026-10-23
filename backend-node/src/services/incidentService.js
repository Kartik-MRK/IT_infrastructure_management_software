import { IncidentRepository } from '../repositories/incidentRepository.js';
import { validateIncidentPayload } from '../schemas/incidentSchema.js';
import { sendCriticalIncidentEmail } from '../core/mail.js';

const PRIVILEGED_ROLES = new Set(['admin', 'it_admin', 'security_auditor']);

export class IncidentService {
  static async getAll(status = null, severity = null, assetId = null) {
    const response = await IncidentRepository.getAll(status, severity, assetId);
    return response.data || [];
  }

  static async getById(incidentId) {
    const response = await IncidentRepository.getById(incidentId);
    return response.data || null;
  }

  static async createIncident(rawData, currentUser) {
    const { cleaned, error } = validateIncidentPayload(rawData, false);
    if (error) {
      return { incident: null, error, statusCode: 400 };
    }

    cleaned.reported_by = currentUser.id;
    cleaned.status = cleaned.status || 'open';

    const response = await IncidentRepository.create(cleaned);
    if (!response.data || response.data.length === 0) {
      return { incident: null, error: 'Failed to create incident', statusCode: 500 };
    }

    const incident = response.data[0];

    // Trigger critical incident email notification
    if (incident.severity === 'critical') {
      try {
        await sendCriticalIncidentEmail(incident, currentUser);
      } catch (err) {
        console.error(`⚠️ Failed to send critical email: ${err.message}`);
      }
    }

    return { incident, error: null, statusCode: 201 };
  }

  static async updateIncident(incidentId, rawData, currentUser) {
    const existingRes = await IncidentRepository.getById(incidentId);
    if (!existingRes.data) {
      return { incident: null, error: 'Incident not found', statusCode: 404 };
    }

    const existing = existingRes.data;

    const canUpdate =
      PRIVILEGED_ROLES.has(currentUser.role) ||
      existing.reported_by === currentUser.id ||
      existing.assigned_to === currentUser.id;

    if (!canUpdate) {
      return {
        incident: null,
        error: 'You do not have permission to update this incident',
        statusCode: 403,
      };
    }

    const { cleaned, error } = validateIncidentPayload(rawData, true);
    if (error) {
      return { incident: null, error, statusCode: 400 };
    }

    if (Object.keys(cleaned).length === 0) {
      return { incident: null, error: 'No valid fields to update', statusCode: 400 };
    }

    // Resolution timestamp and resolver attribution
    if (['resolved', 'closed'].includes(cleaned.status) && !['resolved', 'closed'].includes(existing.status)) {
      cleaned.resolved_at = new Date().toISOString();
      cleaned.resolved_by = currentUser.id;
    } else if (cleaned.status && !['resolved', 'closed'].includes(cleaned.status)) {
      cleaned.resolved_at = null;
      cleaned.resolved_by = null;
    }

    const response = await IncidentRepository.update(incidentId, cleaned);
    if (response.data && response.data.length > 0) {
      return { incident: response.data[0], error: null, statusCode: 200 };
    }
    return { incident: null, error: 'Failed to update incident', statusCode: 500 };
  }

  static async assignIncident(incidentId, assignedToId, _currentUser) {
    const existingRes = await IncidentRepository.getById(incidentId);
    if (!existingRes.data) {
      return { incident: null, error: 'Incident not found', statusCode: 404 };
    }

    const updateData = {
      assigned_to: assignedToId,
      status: existingRes.data.status === 'open' ? 'in_progress' : existingRes.data.status,
    };

    const response = await IncidentRepository.update(incidentId, updateData);
    if (response.data && response.data.length > 0) {
      return { incident: response.data[0], error: null, statusCode: 200 };
    }
    return { incident: null, error: 'Failed to assign incident', statusCode: 500 };
  }

  static async updateStatus(incidentId, newStatus, resolutionNotes, currentUser) {
    const existingRes = await IncidentRepository.getById(incidentId);
    if (!existingRes.data) {
      return { incident: null, error: 'Incident not found', statusCode: 404 };
    }

    const updateData = { status: newStatus };
    if (resolutionNotes !== undefined && resolutionNotes !== null) {
      const cleanNotes = String(resolutionNotes).trim();
      updateData.resolution_notes = cleanNotes.length > 0 ? cleanNotes : null;
    }

    if (['resolved', 'closed'].includes(newStatus)) {
      updateData.resolved_at = new Date().toISOString();
      updateData.resolved_by = currentUser.id;
    }

    const response = await IncidentRepository.update(incidentId, updateData);
    if (response.data && response.data.length > 0) {
      return { incident: response.data[0], error: null, statusCode: 200 };
    }
    return { incident: null, error: 'Failed to update incident status', statusCode: 500 };
  }

  static async escalateIncident(incidentId, priorityBoost = 2, _currentUser) {
    const existingRes = await IncidentRepository.getById(incidentId);
    if (!existingRes.data) {
      return { incident: null, error: 'Incident not found', statusCode: 404 };
    }

    const currentPriority = existingRes.data.priority || 5;
    const newPriority = Math.min(10, currentPriority + priorityBoost);

    const updateData = {
      priority: newPriority,
      severity: newPriority >= 8 ? 'critical' : existingRes.data.severity,
    };

    const response = await IncidentRepository.update(incidentId, updateData);
    if (response.data && response.data.length > 0) {
      return { incident: response.data[0], error: null, statusCode: 200 };
    }
    return { incident: null, error: 'Failed to escalate incident', statusCode: 500 };
  }

  static async deleteIncident(incidentId) {
    const existingRes = await IncidentRepository.getById(incidentId);
    if (!existingRes.data) {
      return { success: false, message: 'Incident not found', statusCode: 404 };
    }

    await IncidentRepository.delete(incidentId);
    return { success: true, message: 'Incident deleted successfully', statusCode: 200 };
  }
}

export default IncidentService;
