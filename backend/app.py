"""
ITIMS Backend Application Entrypoint
Unified Application Gateway & Module Exports
"""

import os
from flask_jwt_extended import get_jwt_identity, jwt_required
from app import create_app
from app.core.database import get_supabase
from app.core.security import get_user_profile, get_current_user_id, role_required
from app.core.mail import mail, send_critical_incident_email

# Create the application instance
app = create_app()

# Export singleton database client for testing & scripts
supabase = get_supabase()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
