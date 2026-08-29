"""
Quick test to check if Flask-Mail is installed and backend can start
Run this from the backend directory: python test_startup.py
"""

try:
    print("Testing Flask-Mail import...")
    from flask_mail import Mail, Message
    print("✅ Flask-Mail imported successfully!")
except ImportError as e:
    print(f"❌ Flask-Mail import failed: {e}")
    print("\nPlease install Flask-Mail:")
    print("pip install Flask-Mail==0.9.1")
    exit(1)

try:
    print("\nTesting Flask app creation...")
    from flask import Flask
    app = Flask(__name__)
    print("✅ Flask app created successfully!")
except Exception as e:
    print(f"❌ Flask app creation failed: {e}")
    exit(1)

try:
    print("\nTesting Mail initialization...")
    app.config['MAIL_SERVER'] = 'smtp.gmail.com'
    app.config['MAIL_PORT'] = 587
    app.config['MAIL_USE_TLS'] = True
    app.config['MAIL_USERNAME'] = 'test@gmail.com'
    app.config['MAIL_PASSWORD'] = 'testpassword'
    mail = Mail(app)
    print("✅ Mail initialized successfully!")
except Exception as e:
    print(f"❌ Mail initialization failed: {e}")
    exit(1)

print("\n✅ All checks passed! Backend should be able to start.")
print("\nNow try running: python app.py")
