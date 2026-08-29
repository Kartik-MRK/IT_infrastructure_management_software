# ITIMS Backend

Flask backend API for IT Infrastructure Management System.

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend` directory by copying `.env.example`:

```bash
cp .env.example .env
```

Then fill in your actual values:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_from_supabase
JWT_SECRET_KEY=generate_a_random_secret_key
```

**Important:** 
- Get your Supabase URL and Service Role Key from: Supabase Dashboard → Project Settings → API
- Generate a secure JWT secret key (e.g., use Python: `import secrets; print(secrets.token_hex(32))`)
- **Never commit the `.env` file to Git**

### 3. Run the Development Server

```bash
python app.py
```

The API will be available at `http://localhost:5000`

## API Endpoints

### Authentication

#### Register User
- **POST** `/api/auth/register`
- Body: `{ "email": "user@example.com", "password": "password123" }`
- Returns: User object and success message

#### Login
- **POST** `/api/auth/login`
- Body: `{ "email": "user@example.com", "password": "password123" }`
- Returns: JWT access token and user object

#### Logout
- **POST** `/api/auth/logout`
- Headers: `Authorization: Bearer <token>`
- Returns: Success message

#### Get Current User
- **GET** `/api/auth/me`
- Headers: `Authorization: Bearer <token>`
- Returns: Current user object

### Health Check

#### Health Status
- **GET** `/api/health`
- Returns: API status

## Tech Stack

- **Flask**: Web framework
- **Flask-CORS**: Cross-Origin Resource Sharing
- **Flask-JWT-Extended**: JWT authentication
- **Supabase**: Database and authentication
- **python-dotenv**: Environment variable management

## Production Deployment

For production, use Gunicorn:

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```
