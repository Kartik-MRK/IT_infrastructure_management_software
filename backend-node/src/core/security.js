import jwt from 'jsonwebtoken';
import config from './config.js';
import { getSupabase } from './database.js';

// Role hierarchy and alias mapping matching Python backend exactly
export const ROLE_ALIASES = {
  admin: new Set(['admin', 'it_admin']),
  operator: new Set([
    'admin', 'it_admin', 'operator', 'infrastructure_engineer',
    'helpdesk_operator', 'asset_custodian', 'security_auditor',
    'financial_auditor', 'technician',
  ]),
  viewer: new Set([
    'admin', 'it_admin', 'operator', 'infrastructure_engineer',
    'helpdesk_operator', 'asset_custodian', 'security_auditor',
    'financial_auditor', 'technician', 'compliance_officer',
    'viewer', 'employee_requester',
  ]),
};

// Test mocks
let mockUserIdGetter = null;
let mockUserProfileGetter = null;

export const setMockUserId = (fn) => {
  mockUserIdGetter = fn;
};

export const setMockUserProfile = (fn) => {
  mockUserProfileGetter = fn;
};

export const resetSecurityMocks = () => {
  mockUserIdGetter = null;
  mockUserProfileGetter = null;
};

/**
 * Generate a signed JWT access token for a user
 */
export const createAccessToken = (userId, extraClaims = {}) => {
  return jwt.sign(
    { sub: userId, ...extraClaims },
    config.JWT_SECRET_KEY,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
};

/**
 * Extract user ID from request Authorization header
 */
export const getCurrentUserId = (req) => {
  if (mockUserIdGetter) {
    try {
      const val = mockUserIdGetter();
      if (val) return String(val);
    } catch {
      // ignore mock error
    }
  }

  const authHeader = req.headers?.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  const token = parts[1];

  // 1. Try standard verified JWT decode
  try {
    const verified = jwt.verify(token, config.JWT_SECRET_KEY);
    if (verified?.sub) {
      return String(verified.sub);
    }
  } catch {
    // Verified decode failed, attempt unverified decode for Supabase tokens
  }

  // 2. Try unverified decode for Supabase auth tokens
  try {
    const decoded = jwt.decode(token);
    if (decoded?.sub) {
      return String(decoded.sub);
    }
  } catch {
    // Decoding failed
  }

  return null;
};

export const getJwtIdentity = (req) => getCurrentUserId(req);

/**
 * Fetch user profile from Supabase profiles table
 */
export const getUserProfile = async (userId) => {
  if (mockUserProfileGetter) {
    try {
      const res = await mockUserProfileGetter(userId);
      if (res && typeof res === 'object') return res;
    } catch {
      // ignore mock error
    }
  }

  const supabase = getSupabase();

  try {
    const { data, error } = await supabase
      .table('profiles')
      .select('*, department:department_id(id, name, code)')
      .eq('id', userId)
      .single();

    if (!error && data) {
      return data;
    }
  } catch {
    // Fallback to basic query without join
  }

  try {
    const { data, error } = await supabase
      .table('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      return data;
    }
  } catch {
    // failed query
  }

  return null;
};

/**
 * Fetch granular permission strings for user
 */
export const getUserPermissions = async (userId) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_user_permissions', { user_uuid: userId });
    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((item) => (typeof item === 'object' ? item.permission_id : item)).filter(Boolean);
    }
  } catch {
    // fallback
  }

  const profile = await getUserProfile(userId);
  if (!profile) return [];

  const role = profile.role || 'viewer';
  if (role === 'admin' || role === 'it_admin') {
    return [
      'assets:read_all', 'assets:create', 'assets:update', 'assets:delete', 'assets:audit_hardware',
      'incidents:read_all', 'incidents:create', 'incidents:assign', 'incidents:update_status', 'incidents:resolve', 'incidents:delete',
      'finance:view_tco', 'finance:view_depreciation', 'security:view_audit_logs', 'security:manage_cve',
      'admin:manage_users', 'admin:manage_roles'
    ];
  } else if (role === 'operator' || role === 'infrastructure_engineer') {
    return [
      'assets:read_all', 'assets:create', 'assets:update', 'assets:delete', 'assets:audit_hardware',
      'incidents:read_all', 'incidents:create', 'incidents:assign', 'incidents:update_status', 'incidents:resolve', 'security:manage_cve'
    ];
  } else if (role === 'security_auditor') {
    return ['assets:read_all', 'incidents:read_all', 'security:view_audit_logs', 'security:manage_cve', 'finance:view_tco'];
  } else if (role === 'helpdesk_operator') {
    return ['assets:read_all', 'incidents:read_all', 'incidents:create', 'incidents:assign', 'incidents:update_status', 'incidents:resolve'];
  } else if (role === 'asset_custodian') {
    return ['assets:read_all', 'assets:create', 'assets:update', 'assets:audit_hardware', 'incidents:read_all', 'incidents:create'];
  } else if (role === 'financial_auditor') {
    return ['assets:read_all', 'finance:view_tco', 'finance:view_depreciation'];
  }

  return ['assets:read_all', 'incidents:read_all', 'incidents:create'];
};

/**
 * Middleware: Role Required Guard
 */
export const roleRequired = (allowedRoles) => {
  return async (req, res, next) => {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Missing or invalid token',
        message: 'Authorization header is required',
      });
    }

    const profile = await getUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userRole = profile.role || 'viewer';

    let isAllowed = allowedRoles.includes(userRole);
    if (!isAllowed) {
      if (userRole === 'admin' || userRole === 'it_admin') {
        isAllowed = true;
      } else {
        for (const reqRole of allowedRoles) {
          if (ROLE_ALIASES[reqRole]?.has(userRole)) {
            isAllowed = true;
            break;
          }
        }
      }
    }

    if (!isAllowed) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Requires one of: ${allowedRoles.join(', ')}`,
      });
    }

    req.currentUser = profile;
    req.userId = userId;
    return next();
  };
};

/**
 * Middleware: Token Required (any authenticated user)
 */
export const tokenRequired = roleRequired(['viewer']);

/**
 * Middleware: Permission Required Guard
 */
export const permissionRequired = (requiredPermission) => {
  return async (req, res, next) => {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Missing or invalid token',
        message: 'Authorization header is required',
      });
    }

    const profile = await getUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userRole = profile.role || 'viewer';
    if (userRole === 'admin' || userRole === 'it_admin') {
      req.currentUser = profile;
      req.userId = userId;
      return next();
    }

    const perms = await getUserPermissions(userId);
    if (!perms.includes(requiredPermission)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Missing permission: '${requiredPermission}'`,
      });
    }

    req.currentUser = profile;
    req.userId = userId;
    return next();
  };
};
