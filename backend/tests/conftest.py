"""
Pytest configuration and fixtures for all tests
Sets up environment and mocks before app initialization
"""
import os
import sys
from unittest.mock import MagicMock, patch

# Set environment variables BEFORE importing app
os.environ['SUPABASE_URL'] = 'https://test.supabase.co'
os.environ['SUPABASE_SERVICE_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE5NTczNDUyMDB9.fake'
os.environ['JWT_SECRET_KEY'] = 'test-jwt-secret'
os.environ['FLASK_ENV'] = 'testing'

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock Supabase client creation before importing app
mock_supabase = MagicMock()
with patch('supabase.create_client', return_value=mock_supabase):
    from app import app

import pytest


@pytest.fixture(scope='session')
def test_app():
    """Create test Flask application"""
    app.config['TESTING'] = True
    return app


@pytest.fixture
def client(test_app):
    """Create test client"""
    with test_app.test_client() as client:
        yield client


@pytest.fixture(autouse=True)
def mock_jwt_required():
    """Automatically mock JWT requirement for all tests"""
    with patch('flask_jwt_extended.view_decorators.verify_jwt_in_request', return_value=None):
        yield
