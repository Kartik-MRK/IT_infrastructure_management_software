"""Post-Mortem & Root Cause Analysis Schema Validation"""

VALID_STATUSES = {'draft', 'under_review', 'published'}
VALID_ITEM_STATUSES = {'pending', 'in_progress', 'completed'}

def validate_postmortem_update_payload(data: dict):
    """Validate payload for updating post-mortem report and action items"""
    if not isinstance(data, dict):
        return None, "Invalid JSON payload"

    cleaned = {}

    if 'title' in data:
        title = str(data['title']).strip()
        if not title:
            return None, "Title cannot be empty"
        cleaned['title'] = title

    if 'executive_summary' in data:
        cleaned['executive_summary'] = str(data['executive_summary'])

    if 'immediate_resolution_steps' in data:
        cleaned['immediate_resolution_steps'] = str(data['immediate_resolution_steps'])

    if 'status' in data:
        status = str(data['status']).strip().lower()
        if status not in VALID_STATUSES:
            return None, f"Invalid status '{status}'. Must be one of: {', '.join(VALID_STATUSES)}"
        cleaned['status'] = status

    if 'root_cause_analysis' in data:
        rca = data['root_cause_analysis']
        if not isinstance(rca, dict):
            return None, "root_cause_analysis must be an object"
        cleaned['root_cause_analysis'] = {
            'methodology': rca.get('methodology', '5_whys'),
            'whys': list(rca.get('whys', [])),
            'root_cause_statement': str(rca.get('root_cause_statement', ''))
        }

    if 'preventative_action_items' in data:
        items = data['preventative_action_items']
        if not isinstance(items, list):
            return None, "preventative_action_items must be a list"
        
        valid_items = []
        for it in items:
            if isinstance(it, dict) and 'task_description' in it:
                valid_items.append({
                    'id': str(it.get('id', '')),
                    'task_description': str(it.get('task_description', '')).strip(),
                    'owner': str(it.get('owner', 'Unassigned')),
                    'status': it.get('status', 'pending') if it.get('status') in VALID_ITEM_STATUSES else 'pending',
                    'priority': it.get('priority', 'medium'),
                    'due_date': str(it.get('due_date', ''))
                })
        cleaned['preventative_action_items'] = valid_items

    if not cleaned:
        return None, "At least one valid field must be provided for update"

    return cleaned, None
