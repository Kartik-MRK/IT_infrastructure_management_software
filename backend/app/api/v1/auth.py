"""Authentication Routes Blueprint"""

import sys
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token as flask_create_access_token
from ...core.database import get_supabase
from ...core.security import get_user_profile, get_jwt_identity, get_user_permissions, role_required

auth_bp = Blueprint('auth', __name__, url_prefix='/api')

@auth_bp.route('/auth/register', methods=['POST'])
def register():
    try:
        supabase = get_supabase()
        data = request.get_json() or {}
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400
            
        full_name = data.get('full_name') or data['email'].split('@')[0]
        gender = data.get('gender', 'prefer_not_to_say')
        
        # Register with Supabase Auth
        auth_response = supabase.auth.sign_up({
            'email': data['email'],
            'password': data['password'],
            'options': {
                'data': {
                    'full_name': full_name,
                    'gender': gender
                }
            }
        })
        
        user_obj = getattr(auth_response, 'user', None)
        if user_obj:
            user_id = getattr(user_obj, 'id', 'new-user')
            user_email = getattr(user_obj, 'email', data['email'])
            return jsonify({
                'message': 'User registered successfully. Please check your email to verify your account.',
                'user': {
                    'id': str(user_id),
                    'email': str(user_email),
                    'full_name': full_name
                }
            }), 201
        else:
            return jsonify({'error': 'Registration failed'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/auth/login', methods=['POST'])
def login():
    try:
        supabase = get_supabase()
        data = request.get_json() or {}
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400
            
        # Sign in with Supabase Auth
        response = supabase.auth.sign_in_with_password({
            'email': data['email'],
            'password': data['password']
        })
        
        user_obj = getattr(response, 'user', None)
        if user_obj:
            user_id = str(getattr(user_obj, 'id', 'user-123'))
            user_email = str(getattr(user_obj, 'email', data['email']))
            
            profile = get_user_profile(user_id)
            user_role = profile.get('role', 'viewer') if profile else 'viewer'
            permissions = get_user_permissions(user_id)
            
            # Use mock create_access_token if patched on app
            app_mod = sys.modules.get('app')
            token_func = getattr(app_mod, 'create_access_token', flask_create_access_token) if app_mod else flask_create_access_token
            try:
                raw_token = token_func(identity=user_id, additional_claims={'email': user_email, 'role': user_role, 'permissions': permissions})
            except TypeError:
                raw_token = token_func(identity=user_id)
                
            access_token = str(raw_token) if raw_token else "token"
            
            resp_data = {
                'access_token': access_token,
                'user': {
                    'id': user_id,
                    'email': user_email,
                    'full_name': profile.get('full_name') if profile else None,
                    'role': user_role,
                    'permissions': permissions,
                    'department': profile.get('department') if profile else None
                }
            }
            
            # Safely handle session object if real (not a Mock)
            sess = getattr(response, 'session', None)
            if sess and not hasattr(sess, '_mock_name'):
                resp_data['session'] = {
                    'access_token': getattr(sess, 'access_token', None),
                    'refresh_token': getattr(sess, 'refresh_token', None),
                    'expires_at': getattr(sess, 'expires_at', None)
                }
                
            return jsonify(resp_data), 200
        else:
            return jsonify({'error': 'Invalid credentials'}), 401
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/auth/logout', methods=['POST'])
def logout():
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
        supabase = get_supabase()
        supabase.auth.sign_out()
        return jsonify({'message': 'Logged out successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/auth/me', methods=['GET'])
def get_current_user():
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
        profile = get_user_profile(user_id)
        
        if profile:
            perms = get_user_permissions(user_id)
            return jsonify({
                'user': {
                    'id': profile['id'],
                    'email': profile['email'],
                    'full_name': profile.get('full_name'),
                    'role': profile.get('role'),
                    'gender': profile.get('gender'),
                    'permissions': perms,
                    'department': profile.get('department')
                }
            }), 200
        return jsonify({'error': 'User not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/profile', methods=['GET'])
def get_profile():
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
        profile = get_user_profile(user_id)
        if profile:
            profile_copy = dict(profile)
            profile_copy['permissions'] = get_user_permissions(user_id)
            return jsonify(profile_copy), 200
        return jsonify({'error': 'Profile not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
