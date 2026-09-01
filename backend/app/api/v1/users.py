"""User Management & Enterprise RBAC Routes Blueprint"""

from flask import Blueprint, request, jsonify
from ...core.database import get_supabase
from ...core.security import get_user_profile, get_jwt_identity, role_required, permission_required
from ...repositories.user_repository import UserRepository
from ...schemas.user_schema import validate_user_role, validate_profile_update
from ...core.mail import mail
from ...core.config import Config
from flask_mail import Message

users_bp = Blueprint('users', __name__, url_prefix='/api')

@users_bp.route('/users', methods=['GET'])
@role_required(['admin', 'it_admin'])
def get_users(current_user):
    try:
        res = UserRepository.get_all()
        return jsonify({'users': res.data or []}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/users/<user_id>', methods=['GET'])
def get_user(user_id):
    try:
        current_user_id = get_jwt_identity()
        if not current_user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        profile = get_user_profile(current_user_id)
        if not profile:
            return jsonify({'error': 'User not found'}), 404
            
        # Admin or self
        if profile.get('role') not in ['admin', 'it_admin'] and current_user_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403
            
        res = UserRepository.get_by_id(user_id)
        if res.data:
            return jsonify({'user': res.data}), 200
        return jsonify({'error': 'User not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/users/<user_id>/role', methods=['PUT'])
@role_required(['admin', 'it_admin'])
def update_user_role(user_id, current_user):
    try:
        data = request.get_json()
        role, error = validate_user_role(data.get('role'))
        if error:
            return jsonify({'error': error}), 400
            
        res = UserRepository.update(user_id, {'role': role})
        if res.data:
            return jsonify({'message': 'User role updated', 'user': res.data[0]}), 200
        return jsonify({'error': 'User not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/users/<user_id>', methods=['PUT'])
def update_user(user_id):
    try:
        current_user_id = get_jwt_identity()
        if not current_user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        profile = get_user_profile(current_user_id)
        if not profile:
            return jsonify({'error': 'User not found'}), 404
            
        if profile.get('role') not in ['admin', 'it_admin'] and current_user_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403
            
        data = request.get_json()
        cleaned, error = validate_profile_update(data)
        if error:
            return jsonify({'error': error}), 400
            
        if 'role' in data:
            if profile.get('role') in ['admin', 'it_admin']:
                role, r_error = validate_user_role(data['role'])
                if not r_error:
                    cleaned['role'] = role
                    
        if 'department_id' in data and profile.get('role') in ['admin', 'it_admin']:
            cleaned['department_id'] = data['department_id']
                    
        res = UserRepository.update(user_id, cleaned)
        if res.data:
            return jsonify({'message': 'User updated successfully', 'user': res.data[0]}), 200
        return jsonify({'error': 'User not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/users/<user_id>', methods=['DELETE'])
@role_required(['admin', 'it_admin'])
def delete_user(user_id, current_user):
    try:
        if current_user.get('id') == user_id:
            return jsonify({'error': 'Cannot delete your own account'}), 400
            
        res = UserRepository.delete(user_id)
        return jsonify({'message': 'User deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/roles', methods=['GET'])
def get_roles():
    """Retrieve all available enterprise roles catalog"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        res = UserRepository.get_roles()
        return jsonify({'roles': res.data or []}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/departments', methods=['GET'])
def get_departments():
    """Retrieve all organization departments"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Missing token', 'message': 'Authorization header is required'}), 401
            
        res = UserRepository.get_departments()
        return jsonify({'departments': res.data or []}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/audit-logs', methods=['GET'])
@role_required(['admin', 'it_admin', 'security_auditor'])
def get_audit_logs(current_user):
    """Retrieve CDC audit logs for security compliance"""
    try:
        limit = int(request.args.get('limit', 50))
        table_name = request.args.get('table_name')
        record_id = request.args.get('record_id')
        
        res = UserRepository.get_audit_logs(limit=limit, table_name=table_name, record_id=record_id)
        return jsonify({'audit_logs': res.data or []}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/test-email', methods=['POST'])
@role_required(['admin', 'it_admin'])
def test_email(current_user):
    try:
        data = request.get_json() or {}
        recipient = data.get('email', Config.ADMIN_EMAIL)
        if not recipient:
            return jsonify({'error': 'Recipient email is required'}), 400
            
        msg = Message(
            subject="🧪 ITIMS Test Email",
            sender=Config.MAIL_DEFAULT_SENDER,
            recipients=[recipient],
            body="This is a test email from the ITIMS Infrastructure Management System."
        )
        mail.send(msg)
        return jsonify({'message': f'Test email sent to {recipient}'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
