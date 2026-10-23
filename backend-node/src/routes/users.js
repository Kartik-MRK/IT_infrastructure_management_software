import { Router } from 'express';
import { UserRepository } from '../repositories/userRepository.js';
import { validateUserRole, validateProfileUpdate } from '../schemas/userSchema.js';
import {
  getCurrentUserId,
  getUserProfile,
  roleRequired,
} from '../core/security.js';
import { getTransporter } from '../core/mail.js';
import config from '../core/config.js';

const router = Router();

/**
 * GET /users - List all users (Admin only)
 */
router.get('/users', roleRequired(['admin', 'it_admin']), async (_req, res) => {
  try {
    const { data, error } = await UserRepository.getAll();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ users: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /roles - Retrieve role catalog
 */
router.get('/roles', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Missing token',
        message: 'Authorization header is required',
      });
    }

    const { data, error } = await UserRepository.getRoles();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ roles: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /departments - Retrieve organization departments
 */
router.get('/departments', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Missing token',
        message: 'Authorization header is required',
      });
    }

    const { data, error } = await UserRepository.getDepartments();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ departments: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /audit-logs - Retrieve CDC audit logs (Admin or Security Auditor)
 */
router.get('/audit-logs', roleRequired(['admin', 'it_admin', 'security_auditor']), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const tableName = req.query.table_name || null;
    const recordId = req.query.record_id || null;

    const { data, error } = await UserRepository.getAuditLogs({
      limit,
      tableName,
      recordId,
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ audit_logs: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /users/:id - Get user profile by ID (Admin or Self)
 */
router.get('/users/:user_id', async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    if (!currentUserId) {
      return res.status(401).json({
        error: 'Missing token',
        message: 'Authorization header is required',
      });
    }

    const profile = await getUserProfile(currentUserId);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUserId = req.params.user_id;
    const isAdmin = profile.role === 'admin' || profile.role === 'it_admin';

    if (!isAdmin && currentUserId !== targetUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data, error } = await UserRepository.getById(targetUserId);
    if (error || !data) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ user: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /users/:id/role - Update user role (Admin only)
 */
router.put('/users/:user_id/role', roleRequired(['admin', 'it_admin']), async (req, res) => {
  try {
    const targetUserId = req.params.user_id;
    const { role, error: validationError } = validateUserRole(req.body?.role);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { data, error } = await UserRepository.update(targetUserId, { role });
    if (error || !data || data.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      message: 'User role updated',
      user: data[0],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /users/:id - Update user profile (Admin or Self)
 */
router.put('/users/:user_id', async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    if (!currentUserId) {
      return res.status(401).json({
        error: 'Missing token',
        message: 'Authorization header is required',
      });
    }

    const profile = await getUserProfile(currentUserId);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUserId = req.params.user_id;
    const isAdmin = profile.role === 'admin' || profile.role === 'it_admin';

    if (!isAdmin && currentUserId !== targetUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const body = req.body || {};
    const { cleaned, error: validationError } = validateProfileUpdate(body);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    // Role and department modifications require admin
    if (isAdmin && 'role' in body) {
      const { role, error: roleErr } = validateUserRole(body.role);
      if (!roleErr) {
        cleaned.role = role;
      }
    }

    if (isAdmin && 'department_id' in body) {
      cleaned.department_id = body.department_id;
    }

    const { data, error } = await UserRepository.update(targetUserId, cleaned);
    if (error || !data || data.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      message: 'User updated successfully',
      user: data[0],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /users/:id - Delete user (Admin only, cannot delete self)
 */
router.delete('/users/:user_id', roleRequired(['admin', 'it_admin']), async (req, res) => {
  try {
    const targetUserId = req.params.user_id;
    if (req.currentUser?.id === targetUserId || req.userId === targetUserId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const { error } = await UserRepository.delete(targetUserId);
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /test-email - Test SMTP email sending (Admin only)
 */
router.post('/test-email', roleRequired(['admin', 'it_admin']), async (req, res) => {
  try {
    const recipient = req.body?.email || config.ADMIN_EMAIL;
    if (!recipient) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    const transporter = getTransporter();
    await transporter.sendMail({
      from: config.SMTP_DEFAULT_SENDER,
      to: recipient,
      subject: '🧪 ITIMS Test Email',
      text: 'This is a test email from the ITIMS Infrastructure Management System.',
    });

    return res.status(200).json({ message: `Test email sent to ${recipient}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
