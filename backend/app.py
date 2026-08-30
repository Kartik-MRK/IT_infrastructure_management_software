from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_mail import Mail, Message
from supabase import create_client, Client
from dotenv import load_dotenv
import os
from datetime import timedelta
from functools import wraps

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configuration
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-this')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

# Email Configuration
app.config['MAIL_SERVER'] = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.getenv('SMTP_PORT', 587))
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USE_SSL'] = False
app.config['MAIL_USERNAME'] = os.getenv('SMTP_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('SMTP_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('SMTP_USERNAME')
app.config['ADMIN_EMAIL'] = os.getenv('ADMIN_EMAIL')

# Initialize extensions
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://localhost:5174"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})
jwt = JWTManager(app)
mail = Mail(app)

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

# Initialize Supabase client
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_KEY')

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file")

supabase: Client = create_client(supabase_url, supabase_key)

# ============================================================================
# RBAC MIDDLEWARE
# ============================================================================

def get_user_profile(user_id):
    """Fetch user profile from Supabase"""
    try:
        response = supabase.table('profiles').select('*').eq('id', user_id).single().execute()
        return response.data
    except Exception as e:
        return None

def role_required(allowed_roles):
    """Decorator to check if user has required role"""
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def decorated_function(*args, **kwargs):
            user_id = get_jwt_identity()
            profile = get_user_profile(user_id)
            
            if not profile:
                return jsonify({'error': 'User profile not found'}), 404
            
            if profile['role'] not in allowed_roles:
                return jsonify({
                    'error': 'Unauthorized',
                    'message': f'This action requires one of these roles: {", ".join(allowed_roles)}'
                }), 403
            
            # Add profile to kwargs so routes can access it
            kwargs['current_user'] = profile
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# ============================================================================
# HEALTH CHECK
# ============================================================================

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'ITIMS API is running'}), 200

# Authentication endpoints
@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        full_name = data.get('full_name')
        gender = data.get('gender')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        signup_payload = {
            'email': email,
            'password': password
        }
        if full_name or gender:
            signup_payload['options'] = {
                'data': {
                    'full_name': full_name or email,
                    'gender': gender or 'prefer_not_to_say'
                }
            }
        
        # Create user in Supabase Auth
        response = supabase.auth.sign_up(signup_payload)
        
        if response.user:
            return jsonify({
                'message': 'User registered successfully',
                'user': {
                    'id': response.user.id,
                    'email': response.user.email
                }
            }), 201
        else:
            return jsonify({'error': 'Registration failed'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Sign in with Supabase
        response = supabase.auth.sign_in_with_password({
            'email': email,
            'password': password
        })
        
        if response.user:
            # Create JWT token
            access_token = create_access_token(identity=response.user.id)
            
            return jsonify({
                'message': 'Login successful',
                'access_token': access_token,
                'user': {
                    'id': response.user.id,
                    'email': response.user.email
                }
            }), 200
        else:
            return jsonify({'error': 'Invalid credentials'}), 401
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/logout', methods=['POST'])
@jwt_required()
def logout():
    try:
        # Sign out from Supabase
        supabase.auth.sign_out()
        return jsonify({'message': 'Logged out successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Protected route example
@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_current_user():
    try:
        user_id = get_jwt_identity()
        
        # Get user from Supabase
        response = supabase.auth.get_user()
        
        if response.user:
            return jsonify({
                'user': {
                    'id': response.user.id,
                    'email': response.user.email
                }
            }), 200
        else:
            return jsonify({'error': 'User not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Get user profile with role
@app.route('/api/profile', methods=['GET'])
@jwt_required()
def get_profile():
    try:
        user_id = get_jwt_identity()
        profile = get_user_profile(user_id)
        
        if profile:
            return jsonify(profile), 200
        else:
            return jsonify({'error': 'Profile not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ASSET MANAGEMENT ENDPOINTS
# ============================================================================

# GET /api/assets - Fetch all assets (accessible to all authenticated users)
@app.route('/api/assets', methods=['GET'])
@jwt_required()
def get_assets():
    try:
        user_id = get_jwt_identity()
        profile = get_user_profile(user_id)
        
        if not profile:
            return jsonify({'error': 'User profile not found'}), 404
        
        # Fetch all assets with creator and assignee details
        response = supabase.table('assets').select('''
            *,
            creator:created_by(id, email, full_name),
            assignee:assigned_to(id, email, full_name)
        ''').execute()
        
        assets = response.data or []
        
        return jsonify({
            'assets': assets,
            'count': len(assets),
            'user_role': profile['role']
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# POST /api/assets - Create new asset (Admin & Operator only)
@app.route('/api/assets', methods=['POST'])
@role_required(['admin', 'operator'])
def create_asset(current_user):
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'type', 'status']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Create asset object
        asset_data = {
            'name': data['name'],
            'type': data['type'],
            'status': data['status'],
            'description': data.get('description', ''),
            'serial_number': data.get('serial_number', ''),
            'location': data.get('location', ''),
            'purchase_date': data.get('purchase_date'),
            'warranty_expiry': data.get('warranty_expiry'),
            'cost': data.get('cost'),
            'assigned_to': data.get('assigned_to'),
            'created_by': current_user['id']
        }
        
        # Insert into database
        response = supabase.table('assets').insert(asset_data).execute()
        
        if response.data:
            return jsonify({
                'message': 'Asset created successfully',
                'asset': response.data[0]
            }), 201
        else:
            return jsonify({'error': 'Failed to create asset'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# GET /api/assets/<id> - Get single asset
@app.route('/api/assets/<asset_id>', methods=['GET'])
@jwt_required()
def get_asset(asset_id):
    try:
        response = supabase.table('assets').select('''
            *,
            creator:created_by(id, email, full_name),
            assignee:assigned_to(id, email, full_name)
        ''').eq('id', asset_id).single().execute()
        
        if response.data:
            return jsonify({'asset': response.data}), 200
        else:
            return jsonify({'error': 'Asset not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# PUT /api/assets/<id> - Update asset (Admin or Operator who created it)
@app.route('/api/assets/<asset_id>', methods=['PUT'])
@role_required(['admin', 'operator'])
def update_asset(asset_id, current_user):
    try:
        # Check if asset exists
        existing = supabase.table('assets').select('*').eq('id', asset_id).single().execute()
        
        if not existing.data:
            return jsonify({'error': 'Asset not found'}), 404
        
        # Check permissions: Admin can edit any, Operator can only edit their own
        if current_user['role'] == 'operator' and existing.data['created_by'] != current_user['id']:
            return jsonify({
                'error': 'Unauthorized',
                'message': 'Operators can only edit assets they created'
            }), 403
        
        data = request.get_json()
        
        # Update asset object (exclude created_by to prevent tampering)
        update_data = {}
        allowed_fields = ['name', 'type', 'status', 'description', 'serial_number', 
                         'location', 'purchase_date', 'warranty_expiry', 'cost', 'assigned_to']
        
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
        
        if not update_data:
            return jsonify({'error': 'No valid fields to update'}), 400
        
        # Perform update
        response = supabase.table('assets').update(update_data).eq('id', asset_id).execute()
        
        if response.data:
            return jsonify({
                'message': 'Asset updated successfully',
                'asset': response.data[0]
            }), 200
        else:
            return jsonify({'error': 'Failed to update asset'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# DELETE /api/assets/<id> - Delete asset (Admin or Operator who created it)
@app.route('/api/assets/<asset_id>', methods=['DELETE'])
@role_required(['admin', 'operator'])
def delete_asset(asset_id, current_user):
    try:
        # Check if asset exists
        existing = supabase.table('assets').select('*').eq('id', asset_id).single().execute()
        
        if not existing.data:
            return jsonify({'error': 'Asset not found'}), 404
        
        # Check permissions: Admin can delete any, Operator can only delete their own
        if current_user['role'] == 'operator' and existing.data['created_by'] != current_user['id']:
            return jsonify({
                'error': 'Unauthorized',
                'message': 'Operators can only delete assets they created'
            }), 403
        
        # Perform delete
        response = supabase.table('assets').delete().eq('id', asset_id).execute()
        
        return jsonify({
            'message': 'Asset deleted successfully',
            'deleted_asset_id': asset_id
        }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# METRICS & ALERTS ENDPOINTS
# ============================================================================

# GET /api/assets/summary - Get asset count summary
@app.route('/api/assets/summary', methods=['GET'])
@jwt_required()
def get_assets_summary():
    try:
        print("📊 GET /api/assets/summary called")
        # Get total count
        total_response = supabase.table('assets').select('id', count='exact').execute()
        total = total_response.count if total_response.count else 0
        print(f"   Total assets: {total}")
        
        # Get count by status
        active_response = supabase.table('assets').select('id', count='exact').eq('status', 'active').execute()
        active = active_response.count if active_response.count else 0
        
        in_use_response = supabase.table('assets').select('id', count='exact').eq('status', 'in_use').execute()
        in_use = in_use_response.count if in_use_response.count else 0
        
        maintenance_response = supabase.table('assets').select('id', count='exact').eq('status', 'maintenance').execute()
        maintenance = maintenance_response.count if maintenance_response.count else 0
        
        retired_response = supabase.table('assets').select('id', count='exact').eq('status', 'retired').execute()
        retired = retired_response.count if retired_response.count else 0
        
        damaged_response = supabase.table('assets').select('id', count='exact').eq('status', 'damaged').execute()
        damaged = damaged_response.count if damaged_response.count else 0
        
        # Get count by type
        hardware_response = supabase.table('assets').select('id', count='exact').eq('type', 'hardware').execute()
        hardware = hardware_response.count if hardware_response.count else 0
        
        software_response = supabase.table('assets').select('id', count='exact').eq('type', 'software').execute()
        software = software_response.count if software_response.count else 0
        
        network_response = supabase.table('assets').select('id', count='exact').eq('type', 'network').execute()
        network = network_response.count if network_response.count else 0
        
        infrastructure_response = supabase.table('assets').select('id', count='exact').eq('type', 'infrastructure').execute()
        infrastructure = infrastructure_response.count if infrastructure_response.count else 0
        
        peripherals_response = supabase.table('assets').select('id', count='exact').eq('type', 'peripherals').execute()
        peripherals = peripherals_response.count if peripherals_response.count else 0
        
        # Get incident statistics (with error handling if table doesn't exist)
        try:
            incidents_response = supabase.table('incidents').select('status, severity').execute()
            incidents = incidents_response.data if incidents_response.data else []
            
            open_incidents = sum(1 for inc in incidents if inc['status'] == 'open')
            critical_incidents = sum(1 for inc in incidents if inc['severity'] == 'critical' and inc['status'] != 'resolved')
        except Exception as incidents_error:
            print(f"⚠️ Incidents table not found or error: {incidents_error}")
            open_incidents = 0
            critical_incidents = 0
        
        return jsonify({
            'summary': {
                'total': total,
                'by_status': {
                    'active': active,
                    'in_use': in_use,
                    'maintenance': maintenance,
                    'retired': retired,
                    'damaged': damaged
                },
                'by_type': {
                    'hardware': hardware,
                    'software': software,
                    'network': network,
                    'infrastructure': infrastructure,
                    'peripherals': peripherals
                },
                'incidents': {
                    'open': open_incidents,
                    'critical': critical_incidents
                }
            }
        }), 200
        
    except Exception as e:
        print(f"❌ Error in /api/assets/summary: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# GET /api/assets/<id>/metrics - Get metrics for specific asset
@app.route('/api/assets/<asset_id>/metrics', methods=['GET'])
@jwt_required()
def get_asset_metrics(asset_id):
    try:
        # Get latest metrics for the asset
        response = supabase.table('asset_metrics').select('*').eq('asset_id', asset_id).order('last_updated', desc=True).limit(1).execute()
        
        if response.data and len(response.data) > 0:
            return jsonify({'metrics': response.data[0]}), 200
        else:
            return jsonify({'metrics': None, 'message': 'No metrics available for this asset'}), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# GET /api/alerts - Get system alerts (Admin only)
@app.route('/api/alerts', methods=['GET'])
@role_required(['admin', 'operator'])
def get_alerts(current_user):
    try:
        print("🚨 GET /api/alerts called")
        # Get assets with critical metrics
        critical_metrics = supabase.table('asset_metrics').select('''
            *,
            asset:asset_id(id, name, type, status)
        ''').eq('health_status', 'critical').order('last_updated', desc=True).limit(10).execute()
        print(f"   Critical metrics found: {len(critical_metrics.data) if critical_metrics.data else 0}")
        if critical_metrics.data:
            for m in critical_metrics.data[:3]:  # Show first 3
                asset_name = m.get('asset', {}).get('name', 'Unknown') if isinstance(m.get('asset'), dict) else 'Unknown'
                print(f"     - {asset_name}: {m.get('cpu_usage')}% CPU, {m.get('temperature')}°C")
        
        # Get assets with warning metrics
        warning_metrics = supabase.table('asset_metrics').select('''
            *,
            asset:asset_id(id, name, type, status)
        ''').eq('health_status', 'warning').order('last_updated', desc=True).limit(5).execute()
        
        # Get assets in maintenance or damaged status
        problematic_assets = supabase.table('assets').select('*').in_('status', ['maintenance', 'damaged']).execute()
        
        alerts = []
        
        # Process critical metrics
        if critical_metrics.data:
            for metric in critical_metrics.data:
                asset_data = metric.get('asset')
                if asset_data:
                    alert = {
                        'id': metric['id'],
                        'severity': 'critical',
                        'asset_id': metric['asset_id'],
                        'asset_name': asset_data.get('name', 'Unknown'),
                        'asset_type': asset_data.get('type', 'unknown'),
                        'timestamp': metric['last_updated']
                    }
                    
                    # Add type-specific message
                    if asset_data.get('type') == 'hardware':
                        issues = []
                        if metric.get('cpu_usage', 0) > 90:
                            issues.append(f"CPU: {metric.get('cpu_usage', 0):.1f}%")
                        if metric.get('memory_usage', 0) > 90:
                            issues.append(f"Memory: {metric.get('memory_usage', 0):.1f}%")
                        if metric.get('temperature', 0) > 75:
                            issues.append(f"Temp: {metric.get('temperature', 0):.1f}°C")
                        if metric.get('disk_usage', 0) > 80:
                            issues.append(f"Disk: {metric.get('disk_usage', 0):.1f}%")
                        
                        if issues:
                            alert['message'] = f"Critical - {', '.join(issues)}"
                        else:
                            alert['message'] = "Hardware metrics critical"
                    elif asset_data.get('type') == 'software':
                        alert['message'] = f"Software not operational: {metric.get('last_error', 'Unknown error')}"
                    elif asset_data.get('type') == 'network':
                        alert['message'] = f"High packet loss: {metric.get('packet_loss_percent', 0):.2f}%"
                    elif asset_data.get('type') == 'infrastructure':
                        alert['message'] = f"Service {metric.get('service_status', 'unknown')}"
                    elif asset_data.get('type') == 'peripherals':
                        issues = []
                        conn_status = metric.get('connection_status', '')
                        print_status = metric.get('print_status', '')
                        
                        if conn_status == 'disconnected':
                            issues.append("Device Disconnected")
                        elif conn_status == 'intermittent':
                            issues.append("Connection Intermittent")
                        
                        if print_status == 'offline':
                            issues.append("Offline")
                        elif print_status == 'paper_jam':
                            issues.append("Paper Jam")
                        elif print_status == 'error':
                            issues.append("Device Error")
                        elif print_status == 'low_toner':
                            issues.append("Low Toner")
                        
                        if metric.get('peripheral_error'):
                            issues.append(metric.get('peripheral_error'))
                        
                        if issues:
                            alert['message'] = f"Peripheral Issue - {', '.join(issues)}"
                        else:
                            alert['message'] = "Peripheral device critical"
                    else:
                        alert['message'] = "Asset health critical"
                    
                    alerts.append(alert)
        
        # Process warning metrics
        if warning_metrics.data:
            for metric in warning_metrics.data:
                asset_data = metric.get('asset')
                if asset_data:
                    alert = {
                        'id': metric['id'],
                        'severity': 'warning',
                        'asset_id': metric['asset_id'],
                        'asset_name': asset_data.get('name', 'Unknown'),
                        'asset_type': asset_data.get('type', 'unknown'),
                        'message': f"Asset showing warning signs",
                        'timestamp': metric['last_updated']
                    }
                    alerts.append(alert)
        
        # Process problematic assets
        if problematic_assets.data:
            for asset in problematic_assets.data:
                alert = {
                    'id': asset['id'],
                    'severity': 'warning',
                    'asset_id': asset['id'],
                    'asset_name': asset['name'],
                    'asset_type': asset['type'],
                    'message': f"Asset status: {asset['status']}",
                    'timestamp': asset['updated_at']
                }
                alerts.append(alert)
        
        print(f"   📋 Returning {len(alerts)} total alerts")
        if alerts:
            for alert in alerts[:3]:  # Show first 3
                print(f"     - {alert['severity'].upper()}: {alert['asset_name']} - {alert['message']}")
        
        return jsonify({
            'alerts': alerts,
            'count': len(alerts)
        }), 200
        
    except Exception as e:
        print(f"❌ Error in /api/alerts: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# ============================================================================
# INCIDENT MANAGEMENT ENDPOINTS
# ============================================================================

# POST /api/incidents - Create new incident
@app.route('/api/incidents', methods=['POST'])
@jwt_required()
def create_incident():
    """Create a new incident report"""
    try:
        current_user = get_jwt_identity()
        user_profile = get_user_profile(current_user)
        
        if not user_profile:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['title', 'description', 'severity']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Validate severity
        valid_severities = ['critical', 'high', 'medium', 'low']
        if data['severity'] not in valid_severities:
            return jsonify({'error': f'Invalid severity. Must be one of: {", ".join(valid_severities)}'}), 400
        
        # Prepare incident data
        incident_data = {
            'title': data['title'],
            'description': data['description'],
            'severity': data['severity'],
            'status': 'open',
            'category': data.get('category'),
            'asset_id': data.get('asset_id'),
            'reported_by': current_user,
            'assigned_to': data.get('assigned_to'),
            'priority': data.get('priority', 5)
        }
        
        # Insert incident
        result = supabase.table('incidents').insert(incident_data).execute()
        
        if result.data:
            incident = result.data[0]
            
            # Send email alert for critical incidents
            if data['severity'] == 'critical':
                try:
                    send_critical_incident_email(incident, user_profile)
                except Exception as email_error:
                    print(f"⚠️ Failed to send email alert: {email_error}")
            
            return jsonify({
                'message': 'Incident created successfully',
                'incident': incident
            }), 201
        else:
            return jsonify({'error': 'Failed to create incident'}), 500
            
    except Exception as e:
        print(f"❌ Error creating incident: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# GET /api/incidents - Get all incidents with filters
@app.route('/api/incidents', methods=['GET'])
@jwt_required()
def get_incidents():
    """Retrieve all incidents with optional filters"""
    try:
        current_user = get_jwt_identity()
        user_profile = get_user_profile(current_user)
        
        if not user_profile:
            return jsonify({'error': 'User not found'}), 404
        
        # Get query parameters for filtering
        status = request.args.get('status')
        severity = request.args.get('severity')
        category = request.args.get('category')
        assigned_to_me = request.args.get('assigned_to_me')
        
        # Build query
        query = supabase.table('incidents').select('''
            *,
            reporter:reported_by(id, email, full_name),
            assignee:assigned_to(id, email, full_name),
            resolver:resolved_by(id, email, full_name),
            asset:asset_id(id, name, type)
        ''')
        
        # Apply filters
        if status:
            query = query.eq('status', status)
        if severity:
            query = query.eq('severity', severity)
        if category:
            query = query.eq('category', category)
        if assigned_to_me == 'true':
            query = query.eq('assigned_to', current_user)
        
        # Order by priority (desc) and reported_at (desc)
        query = query.order('priority', desc=True).order('reported_at', desc=True)
        
        result = query.execute()
        
        return jsonify({
            'incidents': result.data,
            'count': len(result.data)
        }), 200
        
    except Exception as e:
        print(f"❌ Error fetching incidents: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# GET /api/incidents/:id - Get specific incident
@app.route('/api/incidents/<incident_id>', methods=['GET'])
@jwt_required()
def get_incident(incident_id):
    """Get a specific incident by ID"""
    try:
        current_user = get_jwt_identity()
        user_profile = get_user_profile(current_user)
        
        if not user_profile:
            return jsonify({'error': 'User not found'}), 404
        
        result = supabase.table('incidents').select('''
            *,
            reporter:reported_by(id, email, full_name),
            assignee:assigned_to(id, email, full_name),
            resolver:resolved_by(id, email, full_name),
            asset:asset_id(id, name, type, status)
        ''').eq('id', incident_id).single().execute()
        
        if result.data:
            return jsonify({'incident': result.data}), 200
        else:
            return jsonify({'error': 'Incident not found'}), 404
            
    except Exception as e:
        print(f"❌ Error fetching incident: {e}")
        return jsonify({'error': str(e)}), 500

# PUT /api/incidents/:id - Update incident
@app.route('/api/incidents/<incident_id>', methods=['PUT'])
@jwt_required()
def update_incident(incident_id):
    """Update an incident (status, assignment, resolution)"""
    try:
        current_user = get_jwt_identity()
        user_profile = get_user_profile(current_user)
        
        if not user_profile:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        # Check if user has permission to update
        incident_result = supabase.table('incidents').select('reported_by, assigned_to').eq('id', incident_id).single().execute()
        
        if not incident_result.data:
            return jsonify({'error': 'Incident not found'}), 404
        
        incident = incident_result.data
        
        # Only admin, reporter, or assignee can update
        can_update = (
            user_profile['role'] == 'admin' or
            incident['reported_by'] == current_user or
            incident['assigned_to'] == current_user
        )
        
        if not can_update:
            return jsonify({'error': 'You do not have permission to update this incident'}), 403
        
        # Prepare update data
        update_data = {}
        
        if 'status' in data:
            valid_statuses = ['open', 'in_progress', 'resolved', 'closed']
            if data['status'] not in valid_statuses:
                return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400
            update_data['status'] = data['status']
            
            # Set resolved_by if resolving
            if data['status'] in ['resolved', 'closed'] and incident.get('status') not in ['resolved', 'closed']:
                update_data['resolved_by'] = current_user
        
        if 'assigned_to' in data and user_profile['role'] == 'admin':
            update_data['assigned_to'] = data['assigned_to']
        
        if 'priority' in data and user_profile['role'] == 'admin':
            update_data['priority'] = data['priority']
        
        if 'resolution_notes' in data:
            update_data['resolution_notes'] = data['resolution_notes']
        
        if 'severity' in data and user_profile['role'] == 'admin':
            valid_severities = ['critical', 'high', 'medium', 'low']
            if data['severity'] in valid_severities:
                update_data['severity'] = data['severity']
        
        # Update incident
        if update_data:
            result = supabase.table('incidents').update(update_data).eq('id', incident_id).execute()
            
            if result.data:
                return jsonify({
                    'message': 'Incident updated successfully',
                    'incident': result.data[0]
                }), 200
            else:
                return jsonify({'error': 'Failed to update incident'}), 500
        else:
            return jsonify({'error': 'No valid fields to update'}), 400
            
    except Exception as e:
        print(f"❌ Error updating incident: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# DELETE /api/incidents/:id - Delete incident (admin only)
@app.route('/api/incidents/<incident_id>', methods=['DELETE'])
@role_required(['admin'])
def delete_incident(current_user, incident_id):
    """Delete an incident (admin only)"""
    try:
        result = supabase.table('incidents').delete().eq('id', incident_id).execute()
        
        if result.data:
            return jsonify({'message': 'Incident deleted successfully'}), 200
        else:
            return jsonify({'error': 'Incident not found'}), 404
            
    except Exception as e:
        print(f"❌ Error deleting incident: {e}")
        return jsonify({'error': str(e)}), 500

# GET /api/incidents/stats - Get incident statistics
@app.route('/api/incidents/stats', methods=['GET'])
@jwt_required()
def get_incident_stats():
    """Get incident statistics and summaries"""
    try:
        # Get all incidents
        result = supabase.table('incidents').select('severity, status, category').execute()
        
        incidents = result.data
        
        # Calculate statistics
        stats = {
            'total': len(incidents),
            'by_status': {},
            'by_severity': {},
            'by_category': {},
            'open_critical': 0
        }
        
        for incident in incidents:
            # By status
            status = incident['status']
            stats['by_status'][status] = stats['by_status'].get(status, 0) + 1
            
            # By severity
            severity = incident['severity']
            stats['by_severity'][severity] = stats['by_severity'].get(severity, 0) + 1
            
            # By category
            category = incident.get('category', 'other')
            stats['by_category'][category] = stats['by_category'].get(category, 0) + 1
            
            # Open critical count
            if status == 'open' and severity == 'critical':
                stats['open_critical'] += 1
        
        return jsonify(stats), 200
        
    except Exception as e:
        print(f"❌ Error fetching incident stats: {e}")
        return jsonify({'error': str(e)}), 500

# ============================================================================
# EMAIL ALERT HELPER
# ============================================================================

def send_critical_incident_email(incident, reporter):
    """Send email alert for critical incidents"""
    try:
        # Check if email is configured
        if not app.config['MAIL_USERNAME'] or not app.config['MAIL_PASSWORD']:
            print("⚠️ Email not configured. Skipping email alert.")
            print(f"   Set SMTP_USERNAME and SMTP_PASSWORD in .env file")
            return False
        
        if not app.config['ADMIN_EMAIL']:
            print("⚠️ ADMIN_EMAIL not configured. Skipping email alert.")
            return False
        
        print(f"📧 Sending CRITICAL INCIDENT EMAIL ALERT")
        print(f"   To: {app.config['ADMIN_EMAIL']}")
        
        # Create email message
        msg = Message(
            subject=f"🚨 CRITICAL INCIDENT: {incident['title']}",
            sender=app.config['MAIL_DEFAULT_SENDER'],
            recipients=[app.config['ADMIN_EMAIL']]
        )
        
        # Get asset info if available
        asset_info = "N/A"
        if incident.get('asset_id'):
            try:
                asset_result = supabase.table('assets').select('name, type').eq('id', incident['asset_id']).single().execute()
                if asset_result.data:
                    asset_info = f"{asset_result.data['name']} ({asset_result.data['type']})"
            except:
                pass
        
        # Email body (Plain text)
        msg.body = f"""
CRITICAL INCIDENT ALERT - ITIMS
================================

A critical incident has been reported in the IT Infrastructure Management System.

INCIDENT DETAILS:
-----------------
Title:          {incident['title']}
Severity:       {incident['severity'].upper()}
Priority:       {incident.get('priority', 'N/A')}/10
Status:         {incident['status'].upper()}
Category:       {incident.get('category', 'Not specified')}

Description:
{incident['description']}

REPORTED BY:
------------
Name:           {reporter.get('full_name', 'N/A')}
Email:          {reporter.get('email', 'Unknown')}

RELATED ASSET:
--------------
{asset_info}

TIMESTAMP:
----------
Reported at:    {incident.get('created_at', 'Just now')}

ACTION REQUIRED:
----------------
This is a critical incident that requires immediate attention.
Please log in to the ITIMS dashboard to view and manage this incident.

Dashboard: http://localhost:5173/incidents

---
This is an automated message from ITIMS.
Do not reply to this email.
        """
        
        # Email body (HTML - nicer formatting)
        msg.html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #dc2626; color: white; padding: 20px; border-radius: 5px 5px 0 0; }}
                .header h1 {{ margin: 0; font-size: 24px; }}
                .content {{ background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }}
                .section {{ margin-bottom: 20px; }}
                .section-title {{ font-weight: bold; color: #1f2937; margin-bottom: 10px; border-bottom: 2px solid #dc2626; padding-bottom: 5px; }}
                .info-row {{ margin: 5px 0; }}
                .label {{ font-weight: bold; color: #4b5563; }}
                .value {{ color: #1f2937; }}
                .critical {{ color: #dc2626; font-weight: bold; }}
                .description {{ background-color: white; padding: 15px; border-left: 4px solid #dc2626; margin: 10px 0; }}
                .button {{ display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .footer {{ text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚨 CRITICAL INCIDENT ALERT</h1>
                    <p style="margin: 5px 0 0 0;">IT Infrastructure Management System</p>
                </div>
                
                <div class="content">
                    <p>A <span class="critical">critical incident</span> has been reported and requires immediate attention.</p>
                    
                    <div class="section">
                        <div class="section-title">INCIDENT DETAILS</div>
                        <div class="info-row"><span class="label">Title:</span> <span class="value">{incident['title']}</span></div>
                        <div class="info-row"><span class="label">Severity:</span> <span class="critical">{incident['severity'].upper()}</span></div>
                        <div class="info-row"><span class="label">Priority:</span> <span class="value">{incident.get('priority', 'N/A')}/10</span></div>
                        <div class="info-row"><span class="label">Status:</span> <span class="value">{incident['status'].upper()}</span></div>
                        <div class="info-row"><span class="label">Category:</span> <span class="value">{incident.get('category', 'Not specified')}</span></div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">DESCRIPTION</div>
                        <div class="description">{incident['description']}</div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">REPORTED BY</div>
                        <div class="info-row"><span class="label">Name:</span> <span class="value">{reporter.get('full_name', 'N/A')}</span></div>
                        <div class="info-row"><span class="label">Email:</span> <span class="value">{reporter.get('email', 'Unknown')}</span></div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">RELATED ASSET</div>
                        <div class="value">{asset_info}</div>
                    </div>
                    
                    <div style="text-align: center;">
                        <a href="http://localhost:5173/incidents" class="button">View Incident in Dashboard</a>
                    </div>
                </div>
                
                <div class="footer">
                    <p>This is an automated message from ITIMS.</p>
                    <p>Do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Send the email
        mail.send(msg)
        
        print(f"✅ Email sent successfully to {app.config['ADMIN_EMAIL']}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        import traceback
        traceback.print_exc()
        return False

# ============================================================================
# ERROR HANDLERS
# ============================================================================

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
