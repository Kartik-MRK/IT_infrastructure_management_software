import os
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Application Configuration Settings"""
    
    # Secret Keys
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-this')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    
    # Supabase Configuration
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
    
    # Email / SMTP Configuration
    MAIL_PORT = int(os.getenv('SMTP_PORT', 465))
    MAIL_SERVER = os.getenv('SMTP_SERVER', 'smtp.resend.com')
    MAIL_USE_SSL = os.getenv('SMTP_USE_SSL', 'True' if MAIL_PORT == 465 else 'False') == 'True'
    MAIL_USE_TLS = os.getenv('SMTP_USE_TLS', 'False' if MAIL_PORT == 465 else 'True') == 'True'
    MAIL_USERNAME = os.getenv('SMTP_USERNAME', 'resend')
    MAIL_PASSWORD = os.getenv('SMTP_PASSWORD')
    MAIL_DEFAULT_SENDER = os.getenv('SMTP_DEFAULT_SENDER', 'ITIMS Support <auth@mail.kartik-mrk.me>')
    ADMIN_EMAIL = os.getenv('ADMIN_EMAIL')
    
    # CORS Configuration
    CORS_ORIGINS = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174"
    ]
