/**
 * Software License Validation Schemas
 */

export const VALID_LICENSE_TYPES = new Set([
  'per_seat',
  'site_license',
  'per_core',
  'subscription',
  'open_source',
  'oem',
]);

/**
 * Validate software license creation/update payload
 */
export function validateLicenseData(data, isUpdate = false) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { data: null, error: 'Invalid request body format (expected JSON object)' };
  }

  const cleaned = {};

  // Required for creation
  if (!isUpdate) {
    if (!data.software_asset_id) {
      return { data: null, error: 'software_asset_id is required' };
    }
    if (!data.license_name || !String(data.license_name).trim()) {
      return { data: null, error: 'license_name is required' };
    }
  }

  if ('software_asset_id' in data) {
    cleaned.software_asset_id = String(data.software_asset_id).trim();
  }

  if ('license_name' in data) {
    cleaned.license_name = String(data.license_name).trim();
  }

  if ('license_key' in data) {
    cleaned.license_key = data.license_key ? String(data.license_key).trim() : null;
  }

  if ('license_type' in data) {
    const ltype = String(data.license_type).trim().toLowerCase();
    if (!VALID_LICENSE_TYPES.has(ltype)) {
      return {
        data: null,
        error: `Invalid license_type. Must be one of: ${Array.from(VALID_LICENSE_TYPES).sort().join(', ')}`,
      };
    }
    cleaned.license_type = ltype;
  } else if (!isUpdate) {
    cleaned.license_type = 'per_seat';
  }

  if ('total_seats' in data) {
    const seats = parseInt(data.total_seats, 10);
    if (isNaN(seats)) {
      return { data: null, error: 'total_seats must be a valid integer' };
    }
    if (seats < 0) {
      return { data: null, error: 'total_seats must be greater than or equal to 0' };
    }
    cleaned.total_seats = seats;
  } else if (!isUpdate) {
    cleaned.total_seats = 1;
  }

  if ('cost_per_seat' in data) {
    if (data.cost_per_seat !== null && data.cost_per_seat !== undefined) {
      const cost = parseFloat(data.cost_per_seat);
      if (isNaN(cost)) {
        return { data: null, error: 'cost_per_seat must be a numeric value' };
      }
      cleaned.cost_per_seat = cost;
    } else {
      cleaned.cost_per_seat = 0.0;
    }
  }

  if ('purchase_date' in data) {
    const pdate = data.purchase_date;
    if (pdate) {
      const dateStr = String(pdate).trim().slice(0, 10);
      if (isNaN(Date.parse(dateStr))) {
        return { data: null, error: 'purchase_date must be formatted as YYYY-MM-DD' };
      }
      cleaned.purchase_date = dateStr;
    } else {
      cleaned.purchase_date = null;
    }
  }

  if ('expiration_date' in data) {
    const edate = data.expiration_date;
    if (edate) {
      const dateStr = String(edate).trim().slice(0, 10);
      if (isNaN(Date.parse(dateStr))) {
        return { data: null, error: 'expiration_date must be formatted as YYYY-MM-DD' };
      }
      cleaned.expiration_date = dateStr;
    } else {
      cleaned.expiration_date = null;
    }
  }

  if ('vendor' in data) {
    cleaned.vendor = data.vendor ? String(data.vendor).trim() : null;
  }

  if ('department_id' in data) {
    cleaned.department_id = data.department_id ? String(data.department_id).trim() : null;
  }

  return { data: cleaned, error: null };
}

/**
 * Validate license seat allocation payload
 */
export function validateAllocationData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { data: null, error: 'Invalid request body format (expected JSON object)' };
  }

  const assetId = data.allocated_to_asset_id;
  const userId = data.allocated_to_user_id;

  if (!assetId && !userId) {
    return {
      data: null,
      error: 'Seat must be allocated to either an asset (allocated_to_asset_id) or a user (allocated_to_user_id)',
    };
  }

  const cleaned = {
    allocated_to_asset_id: assetId ? String(assetId).trim() : null,
    allocated_to_user_id: userId ? String(userId).trim() : null,
    notes: data.notes ? String(data.notes).trim() : null,
  };

  return { data: cleaned, error: null };
}
