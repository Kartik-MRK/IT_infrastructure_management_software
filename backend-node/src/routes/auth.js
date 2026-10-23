import { Router } from 'express';
import { getSupabase } from '../core/database.js';
import {
  createAccessToken,
  getCurrentUserId,
  getUserProfile,
  getUserPermissions,
} from '../core/security.js';

const router = Router();

/**
 * POST /auth/register
 */
router.post('/auth/register', async (req, res) => {
  try {
    const data = req.body || {};
    if (!data.email || !data.password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const fullName = data.full_name || data.email.split('@')[0];
    const gender = data.gender || 'prefer_not_to_say';

    const supabase = getSupabase();
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: fullName,
          gender,
        },
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message || 'Registration failed' });
    }

    const userObj = authData?.user;
    if (userObj) {
      return res.status(201).json({
        message: 'User registered successfully. Please check your email to verify your account.',
        user: {
          id: String(userObj.id || 'new-user'),
          email: String(userObj.email || data.email),
          full_name: fullName,
        },
      });
    }

    return res.status(400).json({ error: 'Registration failed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /auth/login
 */
router.post('/auth/login', async (req, res) => {
  try {
    const data = req.body || {};
    if (!data.email || !data.password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Guest viewer bypass
    if (data.email === 'guest.viewer@itims.local') {
      const guestId = '00000000-0000-0000-0000-000000000001';
      const guestEmail = 'guest.viewer@itims.local';
      const guestToken = createAccessToken(guestId, {
        email: guestEmail,
        role: 'viewer',
        permissions: ['view:assets', 'view:incidents', 'view:audits'],
      });

      return res.status(200).json({
        access_token: guestToken,
        user: {
          id: guestId,
          email: guestEmail,
          full_name: 'Guest Viewer',
          role: 'viewer',
          permissions: ['view:assets', 'view:incidents', 'view:audits'],
          department: 'Operations',
        },
      });
    }

    const supabase = getSupabase();
    let authResponse = null;

    try {
      authResponse = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
    } catch (err) {
      return res.status(503).json({ error: `Database connection error: ${err.message}` });
    }

    if (authResponse?.error) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userObj = authResponse?.data?.user;
    if (!userObj) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userId = String(userObj.id || 'user-123');
    const userEmail = String(userObj.email || data.email);

    const profile = await getUserProfile(userId);
    const userRole = profile?.role || 'viewer';
    const permissions = await getUserPermissions(userId);

    const accessToken = createAccessToken(userId, {
      email: userEmail,
      role: userRole,
      permissions,
    });

    const responsePayload = {
      access_token: accessToken,
      user: {
        id: userId,
        email: userEmail,
        full_name: profile?.full_name || null,
        role: userRole,
        permissions,
        department: profile?.department || null,
      },
    };

    const session = authResponse?.data?.session;
    if (session) {
      responsePayload.session = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      };
    }

    return res.status(200).json(responsePayload);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /auth/logout
 */
router.post('/auth/logout', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Missing token',
        message: 'Authorization header is required',
      });
    }

    const supabase = getSupabase();
    await supabase.auth.signOut();
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /auth/me
 */
router.get('/auth/me', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Missing token',
        message: 'Authorization header is required',
      });
    }

    const profile = await getUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    const permissions = await getUserPermissions(userId);
    return res.status(200).json({
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        gender: profile.gender,
        permissions,
        department: profile.department,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /profile
 */
router.get('/profile', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Missing token',
        message: 'Authorization header is required',
      });
    }

    const profile = await getUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const permissions = await getUserPermissions(userId);
    return res.status(200).json({
      ...profile,
      permissions,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
