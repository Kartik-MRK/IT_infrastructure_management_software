/**
 * REST API Endpoints for Incident Post-Mortems & Root Cause Analysis (RCA)
 */

import { Router } from 'express';
import { PostMortemService } from '../services/postmortemService.js';
import { getCurrentUserId } from '../core/security.js';

const router = Router();

/**
 * Middleware ensuring authentication
 */
const requireAuth = (req, res, next) => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Missing token', message: 'Authorization header is required' });
  }
  next();
};

/**
 * POST /incidents/:id/postmortem/generate - Generate or refresh automated post-mortem draft for an incident
 */
router.post('/incidents/:incident_id/postmortem/generate', requireAuth, async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const { draft, error, statusCode } = await PostMortemService.generateDraft(
      req.params.incident_id,
      userId
    );

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(statusCode).json({
      postmortem: draft,
      message: 'Post-mortem draft generated',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /incidents/:id/postmortem - Fetch post-mortem document for an incident
 */
router.get('/incidents/:incident_id/postmortem', requireAuth, async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const { postmortem, error, statusCode } = await PostMortemService.getPostmortem(
      req.params.incident_id,
      true,
      userId
    );

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json({ postmortem });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /incidents/:id/postmortem - Update post-mortem content, 5-Whys, or action items
 */
router.put('/incidents/:incident_id/postmortem', requireAuth, async (req, res) => {
  try {
    const { postmortem, error, statusCode } = await PostMortemService.updatePostmortem(
      req.params.incident_id,
      req.body
    );

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json({
      postmortem,
      message: 'Post-mortem updated successfully',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /incidents/:id/postmortem/export - Export formatted Markdown report
 */
router.get('/incidents/:incident_id/postmortem/export', requireAuth, async (req, res) => {
  try {
    const { markdown, error, statusCode } = await PostMortemService.exportMarkdown(
      req.params.incident_id
    );

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json({ markdown });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /postmortems - List all post-mortem reports
 */
router.get('/postmortems', requireAuth, async (req, res) => {
  try {
    const status = req.query.status || null;
    const { postmortems, error, statusCode } = await PostMortemService.listPostmortems(status);

    if (error) {
      return res.status(statusCode).json({ error });
    }

    return res.status(200).json({
      postmortems,
      count: postmortems.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
