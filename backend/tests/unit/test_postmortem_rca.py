"""Unit Tests for Post-Mortem & Root Cause Analysis (RCA) Generator"""

import pytest
from unittest.mock import Mock, patch
from app import app
from app.schemas.postmortem_schema import validate_postmortem_update_payload
from app.services.postmortem_service import PostMortemService

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

class TestPostMortemSchema:
    """Test payload validation for post-mortem updates and action items"""

    def test_valid_update_payload(self):
        data = {
            'title': 'Post-Mortem: Core Switch BGP Drop',
            'executive_summary': 'Outage caused by BGP flapping on port 4.',
            'status': 'under_review',
            'root_cause_analysis': {
                'methodology': '5_whys',
                'whys': ['Link flapped', 'Cable degraded', 'Bend radius exceeded'],
                'root_cause_statement': 'Physical fiber bend radius exceeded specification.'
            },
            'preventative_action_items': [
                {
                    'id': 'act-1',
                    'task_description': 'Replace fiber patch cord',
                    'owner': 'John Doe',
                    'status': 'completed',
                    'priority': 'high',
                    'due_date': '2026-09-10'
                }
            ]
        }
        cleaned, error = validate_postmortem_update_payload(data)
        assert error is None
        assert cleaned['title'] == 'Post-Mortem: Core Switch BGP Drop'
        assert cleaned['status'] == 'under_review'
        assert len(cleaned['preventative_action_items']) == 1

    def test_empty_title_rejection(self):
        cleaned, error = validate_postmortem_update_payload({'title': '   '})
        assert "cannot be empty" in error

    def test_invalid_status_rejection(self):
        cleaned, error = validate_postmortem_update_payload({'status': 'invalid_random_status'})
        assert "Invalid status" in error

class TestPostMortemService:
    """Test Post-Mortem service logic and Markdown generation"""

    @patch('app.services.postmortem_service.PostMortemRepository')
    def test_generate_draft_success(self, mock_repo):
        mock_repo.generate_draft.return_value = {
            'id': 'pm-1',
            'incident_id': 'inc-10',
            'title': 'Post-Mortem: DB Deadlock',
            'status': 'draft'
        }
        draft, error, status = PostMortemService.generate_draft('inc-10', 'user-1')
        assert status == 201
        assert draft['id'] == 'pm-1'

    @patch('app.services.postmortem_service.PostMortemRepository')
    def test_export_markdown_formatting(self, mock_repo):
        mock_repo.get_by_incident_id.return_value = {
            'id': 'pm-1',
            'incident_id': 'inc-10',
            'title': 'Post-Mortem: Storage Pool Out of Space',
            'status': 'published',
            'executive_summary': 'SAN array ran out of capacity due to snapshot retention.',
            'impact_summary': {
                'duration_minutes': 45,
                'severity': 'critical',
                'sla_breached': False,
                'primary_asset': 'SAN-Storage-Array-01'
            },
            'timeline_events': [
                {'timestamp': '2026-09-01T10:00:00Z', 'title': 'Detected', 'description': 'Disk 100% full', 'actor': 'Monitoring'}
            ],
            'root_cause_analysis': {
                'whys': ['Storage full', 'Auto-prune failed', 'Cron disabled'],
                'root_cause_statement': 'Cron job for snapshot cleanup was disabled.'
            },
            'immediate_resolution_steps': 'Purged old snapshots.',
            'preventative_action_items': [
                {'task_description': 'Re-enable snapshot cron', 'owner': 'Admin', 'status': 'completed', 'priority': 'high', 'due_date': '2026-09-02'}
            ]
        }

        md, error, status = PostMortemService.export_markdown('inc-10')
        assert status == 200
        assert "# 📋 Incident Post-Mortem: Post-Mortem: Storage Pool Out of Space" in md
        assert "SAN-Storage-Array-01" in md
        assert "5-Whys Framework" in md
        assert "[x] **Re-enable snapshot cron**" in md

class TestPostMortemEndpoints:
    """Test REST API endpoints for Post-Mortems"""

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.postmortem_service.PostMortemRepository')
    def test_generate_postmortem_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'user-1'
        mock_profile.return_value = {'id': 'user-1', 'role': 'operator'}
        mock_repo.generate_draft.return_value = {'id': 'pm-99', 'title': 'Post-Mortem: App Server Outage'}

        res = client.post('/api/incidents/inc-1/postmortem/generate',
                          headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 201
        data = res.get_json()
        assert data['postmortem']['id'] == 'pm-99'

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.postmortem_service.PostMortemRepository')
    def test_get_postmortem_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'user-1'
        mock_profile.return_value = {'id': 'user-1', 'role': 'viewer'}
        mock_repo.get_by_incident_id.return_value = {'id': 'pm-99', 'title': 'Post-Mortem Report'}

        res = client.get('/api/incidents/inc-1/postmortem',
                         headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['postmortem']['title'] == 'Post-Mortem Report'

    @patch('app.get_jwt_identity')
    @patch('app.get_user_profile')
    @patch('app.services.postmortem_service.PostMortemRepository')
    def test_export_postmortem_endpoint(self, mock_repo, mock_profile, mock_jwt, client):
        mock_jwt.return_value = 'user-1'
        mock_profile.return_value = {'id': 'user-1', 'role': 'viewer'}
        mock_repo.get_by_incident_id.return_value = {
            'id': 'pm-99',
            'title': 'Export Test',
            'impact_summary': {'duration_minutes': 30, 'severity': 'high', 'sla_breached': False}
        }

        res = client.get('/api/incidents/inc-1/postmortem/export',
                         headers={'Authorization': 'Bearer test-token'})
        assert res.status_code == 200
        data = res.get_json()
        assert "Incident Post-Mortem" in data['markdown']
