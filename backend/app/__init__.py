"""Application Factory and Module Exports for ITIMS Backend"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token
from .core.config import Config
from .core.database import get_supabase
from .core.mail import mail, send_critical_incident_email
from .core.security import get_user_profile, get_current_user_id, get_jwt_identity, role_required

# Blueprints
from .api.v1.auth import auth_bp
from .api.v1.assets import assets_bp
from .api.v1.incidents import incidents_bp
from .api.v1.alerts import alerts_bp
from .api.v1.activities import activities_bp
from .api.v1.users import users_bp
from .api.v1.licenses import licenses_bp
from .api.v1.financials import financials_bp
from .api.v1.audits import audits_bp
from .api.v1.sla import sla_bp
from .api.v1.telemetry import telemetry_bp

def create_app(config_class=Config):
    """Create and configure Flask application instance"""
    flask_app = Flask(__name__)
    
    # Load configuration
    flask_app.config['JWT_SECRET_KEY'] = config_class.JWT_SECRET_KEY
    flask_app.config['JWT_ACCESS_TOKEN_EXPIRES'] = config_class.JWT_ACCESS_TOKEN_EXPIRES
    flask_app.config['MAIL_SERVER'] = config_class.MAIL_SERVER
    flask_app.config['MAIL_PORT'] = config_class.MAIL_PORT
    flask_app.config['MAIL_USE_SSL'] = config_class.MAIL_USE_SSL
    flask_app.config['MAIL_USE_TLS'] = config_class.MAIL_USE_TLS
    flask_app.config['MAIL_USERNAME'] = config_class.MAIL_USERNAME
    flask_app.config['MAIL_PASSWORD'] = config_class.MAIL_PASSWORD
    flask_app.config['MAIL_DEFAULT_SENDER'] = config_class.MAIL_DEFAULT_SENDER
    flask_app.config['ADMIN_EMAIL'] = config_class.ADMIN_EMAIL
    
    # Initialize extensions
    CORS(flask_app, resources={
        r"/api/*": {
            "origins": config_class.CORS_ORIGINS,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        }
    })
    
    jwt = JWTManager(flask_app)
    mail.init_app(flask_app)
    
    # JWT Error Handlers
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({'error': 'Token has expired', 'message': 'Please login again'}), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({'error': 'Invalid token', 'message': str(error)}), 422
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
        
    # Register Blueprints
    flask_app.register_blueprint(auth_bp)
    flask_app.register_blueprint(assets_bp)
    flask_app.register_blueprint(incidents_bp)
    flask_app.register_blueprint(alerts_bp)
    flask_app.register_blueprint(activities_bp)
    flask_app.register_blueprint(users_bp)
    flask_app.register_blueprint(licenses_bp)
    flask_app.register_blueprint(financials_bp)
    flask_app.register_blueprint(audits_bp)
    flask_app.register_blueprint(sla_bp)
    flask_app.register_blueprint(telemetry_bp)
    
    # Health check endpoints
    @flask_app.route('/health', methods=['GET'])
    @flask_app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({'status': 'healthy', 'message': 'API is running', 'service': 'ITIMS Backend'}), 200
        
    # Error Handlers
    @flask_app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Endpoint not found'}), 404
        
    @flask_app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error'}), 500
        
    return flask_app

# Default application instance for imports and runtime
app = create_app()

# Database singleton
supabase = get_supabase()

def jwt_required(optional=False, fresh=False, refresh=False, locations=None, verify_type=True):
    """Mock-aware and test-aware jwt_required decorator"""
    def wrapper(fn):
        from functools import wraps
        @wraps(fn)
        def decorator(*args, **kwargs):
            user_id = get_jwt_identity()
            if not user_id and not optional:
                return jsonify({'error': 'Missing or invalid token', 'message': 'Authorization header is required'}), 401
            return fn(*args, **kwargs)
        return decorator
    return wrapper

__all__ = [
    'create_app',
    'app',
    'supabase',
    'mail',
    'get_user_profile',
    'get_current_user_id',
    'role_required',
    'send_critical_incident_email',
    'get_jwt_identity',
    'jwt_required',
    'create_access_token'
]
