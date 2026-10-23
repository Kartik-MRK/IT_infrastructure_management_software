/**
 * Post-Mortem & Root Cause Analysis Schema Validation
 */

export const VALID_STATUSES = new Set(['draft', 'under_review', 'published']);
export const VALID_ITEM_STATUSES = new Set(['pending', 'in_progress', 'completed']);

/**
 * Validate payload for updating post-mortem report and action items
 */
export function validatePostmortemUpdatePayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { data: null, error: 'Invalid JSON payload' };
  }

  const cleaned = {};

  if ('title' in data) {
    const title = String(data.title).trim();
    if (!title) {
      return { data: null, error: 'Title cannot be empty' };
    }
    cleaned.title = title;
  }

  if ('executive_summary' in data) {
    cleaned.executive_summary = String(data.executive_summary);
  }

  if ('immediate_resolution_steps' in data) {
    cleaned.immediate_resolution_steps = String(data.immediate_resolution_steps);
  }

  if ('status' in data) {
    const status = String(data.status).trim().toLowerCase();
    if (!VALID_STATUSES.has(status)) {
      return {
        data: null,
        error: `Invalid status '${status}'. Must be one of: ${Array.from(VALID_STATUSES).join(', ')}`,
      };
    }
    cleaned.status = status;
  }

  if ('root_cause_analysis' in data) {
    const rca = data.root_cause_analysis;
    if (!rca || typeof rca !== 'object' || Array.isArray(rca)) {
      return { data: null, error: 'root_cause_analysis must be an object' };
    }
    cleaned.root_cause_analysis = {
      methodology: rca.methodology || '5_whys',
      whys: Array.isArray(rca.whys) ? rca.whys.map(String) : [],
      root_cause_statement: String(rca.root_cause_statement || ''),
    };
  }

  if ('preventative_action_items' in data) {
    const items = data.preventative_action_items;
    if (!Array.isArray(items)) {
      return { data: null, error: 'preventative_action_items must be a list' };
    }

    const validItems = [];
    for (const it of items) {
      if (it && typeof it === 'object' && 'task_description' in it) {
        validItems.append ? null : null;
        validItems.push({
          id: String(it.id || ''),
          task_description: String(it.task_description || '').trim(),
          owner: String(it.owner || 'Unassigned'),
          status: VALID_ITEM_STATUSES.has(it.status) ? it.status : 'pending',
          priority: it.priority || 'medium',
          due_date: String(it.due_date || ''),
        });
      }
    }
    cleaned.preventative_action_items = validItems;
  }

  if (Object.keys(cleaned).length === 0) {
    return { data: null, error: 'At least one valid field must be provided for update' };
  }

  return { data: cleaned, error: null };
}
