import { Router } from 'express';
import { IncidentService } from '../services/incidentService.js';
import { getCurrentUserId, getUserProfile, roleRequired } from '../core/security.js';

const router = Router();

/**
 * GET /incidents/stats - Aggregate stats for incidents
 */
router.get('/incidents/stats', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const incidents = await IncidentService.getAll();
    const stats = {
      total: incidents.length,
      by_status: {},
      by_severity: {},
      by_category: {},
      open_critical: 0,
    };

    incidents.forEach((inc) => {
      const status = inc.status || 'open';
      const severity = inc.severity || 'low';
      const category = inc.category || 'other';

      stats.by_status[status] = (stats.by_status[status] || 0) + 1;
      stats.by_severity[severity] = (stats.by_severity[severity] || 0) + 1;
      stats.by_category[category] = (stats.by_category[category] || 0) + 1;

      if (status === 'open' && severity === 'critical') {
        stats.open_critical += 1;
      }
    });

    return res.status(200).json(stats);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /incidents - List incidents with filters
 */
router.get('/incidents', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const status = req.query.status || null;
    const severity = req.query.severity || null;
    const assetId = req.query.asset_id || null;

    const incidents = await IncidentService.getAll(status, severity, assetId);
    return res.status(200).json({
      incidents,
      count: incidents.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /incidents - Create new incident
 */
router.post('/incidents', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const profile = await getUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const { incident, error, statusCode } = await IncidentService.createIncident(req.body, profile);
    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(201).json({
      message: 'Incident reported successfully',
      incident,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /incidents/:id - Get single incident details
 */
router.get('/incidents/:incident_id', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const incident = await IncidentService.getById(req.params.incident_id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    return res.status(200).json({ incident });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /incidents/:id - Update incident
 */
router.put('/incidents/:incident_id', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
    }

    const profile = await getUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const { incident, error, statusCode } = await IncidentService.updateIncident(
      req.params.incident_id,
      req.body,
      profile
    );

    if (error) {
      return res.status(statusCode).json({ error, message: error });
    }

    return res.status(200).json({
      message: 'Incident updated successfully',
      incident,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /incidents/:id/assign - Assign incident to operator
 */
router.put('/incidents/:incident_id/assign', roleRequired(['admin', 'operator']), async (req, res) => {
  try {
    const assignedTo = req.body?.assigned_to;
    if (!assignedTo) {
      return res.status(400).json({ error: 'assigned_to field is required' });
    }

    const { incident, error, statusCode } = await IncidentService.assignIncident(
      req.params.incident_id,
      assignedTo,
      req.currentUser
    );

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json({
      message: 'Incident assigned successfully',
      incident,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /incidents/:id/status - Update incident status
 */
router.put('/incidents/:incident_id/status', roleRequired(['admin', 'operator']), async (req, res) => {
  try {
    const newStatus = req.body?.status;
    const resolutionNotes = req.body?.resolution_notes;

    if (!newStatus) {
      return res.status(400).json({ error: 'status field is required' });
    }

    const { incident, error, statusCode } = await IncidentService.updateStatus(
      req.params.incident_id,
      newStatus,
      resolutionNotes,
      req.currentUser
    );

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json({
      message: `Incident status updated to ${newStatus}`,
      incident,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /incidents/:id/escalate - Escalate incident priority
 */
router.post('/incidents/:incident_id/escalate', roleRequired(['admin', 'operator']), async (req, res) => {
  try {
    const priorityBoost = parseInt(req.body?.priority_boost || '2', 10);
    const { incident, error, statusCode } = await IncidentService.escalateIncident(
      req.params.incident_id,
      priorityBoost,
      req.currentUser
    );

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json({
      message: 'Incident escalated successfully',
      incident,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /incidents/:id - Delete incident (Admin only)
 */
router.delete('/incidents/:incident_id', roleRequired(['admin']), async (req, res) => {
  try {
    const { message, statusCode } = await IncidentService.deleteIncident(req.params.incident_id);
    return res.status(statusCode).json({ message });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
