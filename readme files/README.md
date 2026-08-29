# IT infrastructure management software

**Project ID:** P03  
**Course:** UE23CS341A  
**Academic Year:** 2025  
**Semester:** 5th Sem  
**Campus:** EC  
**Branch:** CSE  
**Section:** D  
**Team:** Git Souls

## 📋 Project Description

This is management of hardware, software and other infrastructure related activities. Buying hardware/software, making sure that licensed software is installed on all office hardware, etc

This repository contains the source code and documentation for the IT infrastructure management software project, developed as part of the UE23CS341A course at PES University.

## 🧑‍💻 Development Team (Git Souls)

- [@sasukeuchiha14](https://github.com/sasukeuchiha14) - Scrum Master
- [@Kartik-MRK](https://github.com/Kartik-MRK) - Developer Team
- [@jagathsaradigi](https://github.com/jagathsaradigi) - Developer Team
- [@PES2UG23CS227](https://github.com/PES2UG23CS227) - Developer Team

## 👨‍🏫 Teaching Assistant

- [@dredblackblue](https://github.com/dredblackblue)
- [@shreyavijay2022](https://github.com/shreyavijay2022)
- [@Meenakshi4d5f](https://github.com/Meenakshi4d5f)
- [@tejaswiniv27](https://github.com/tejaswiniv27)
- [@Shriya285](https://github.com/Shriya285)

## 👨‍⚖️ Faculty Supervisor

- *No valid faculty GitHub username found*


## 🚀 Tech Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Supabase Client** - Authentication and database
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Recharts** - Data visualization

### Backend
- **Flask** - Python web framework
- **Flask-JWT-Extended** - JWT authentication
- **Flask-CORS** - Cross-origin resource sharing
- **Supabase** - PostgreSQL database and auth
- **Gunicorn** - WSGI HTTP server (production)

### Database & Auth
- **Supabase** - Backend-as-a-service (PostgreSQL + Auth)

## 📁 Project Structure

```
PESU_EC_CSE_D_P03_IT_infrastructure_management_software_Git-Souls/
├── frontend/                  # React frontend
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── pages/           # Page components
│   │   │   ├── Login.jsx
│   │   │   └── Dashboard.jsx
│   │   ├── lib/             # Utility libraries
│   │   │   └── supabase.js
│   │   ├── App.jsx          # Root component
│   │   ├── main.jsx         # Entry point
│   │   └── index.css        # Global styles
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── .env.example
│
├── backend/                  # Flask backend
│   ├── app.py               # Main Flask application
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example         # Environment variables template
│   └── README.md            # Backend documentation
│
└── README.md                # This file
```

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)
- **Git**
- **Supabase Account** (free tier available at [supabase.com](https://supabase.com))

### Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be fully initialized
3. Go to **Project Settings** → **API**
4. Copy the following:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (for frontend)
   - **service_role** key (for backend - keep this secret!)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/pestechnology/PESU_EC_CSE_D_P03_IT_infrastructure_management_software_Git-Souls.git
   cd PESU_EC_CSE_D_P03_IT_infrastructure_management_software_Git-Souls
   ```

2. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   
   # Create environment file
   cp .env.example .env
   # Edit .env and add your Supabase URL and anon key
   
   # Start development server
   npm run dev
   ```
   Frontend will be available at `http://localhost:5173`

3. **Backend Setup**
   ```bash
   cd backend
   
   # Create virtual environment
   python -m venv venv
   
   # Activate virtual environment
   # Windows:
   venv\Scripts\activate
   # Mac/Linux:
   source venv/bin/activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Create environment file
   cp .env.example .env
   # Edit .env and add your Supabase URL, service role key, and JWT secret
   
   # Start Flask server
   python app.py
   ```
   Backend API will be available at `http://localhost:5000`

## 🎨 Features

### Day 1 - Authentication (✅ Completed)
- [x] Professional login page with modern UI
- [x] User registration (sign up)
- [x] Email/password authentication via Supabase
- [x] Protected routes with session management
- [x] Responsive design (desktop + mobile)
- [x] Backend API endpoints for auth
- [x] JWT token-based authentication

### Planned Features
- [ ] Asset Management (CRUD operations)
- [ ] Incident Reporting and Tracking
- [ ] User Role Management (Admin, User, Viewer)
- [ ] Dashboard with Real-time Analytics
- [ ] Notification System
- [ ] Comprehensive Reports Generation
- [ ] Advanced Search and Filtering
- [ ] Data Visualization with Charts

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user (requires JWT)
- `GET /api/auth/me` - Get current user (requires JWT)

### Health Check
- `GET /api/health` - API health status

See `backend/README.md` for detailed API documentation.

## 🔐 Environment Variables

### Frontend (.env)
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your_anon_key
```

### Backend (.env)
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...your_service_role_key
JWT_SECRET_KEY=your_random_secret_key
FLASK_ENV=development
FLASK_DEBUG=True
```

**⚠️ Important:** Never commit `.env` files to Git!

## 🚦 Development Workflow

### Starting Both Servers

**Terminal 1 (Frontend):**
```bash
cd frontend
npm run dev
```

**Terminal 2 (Backend):**
```bash
cd backend
python app.py
```

### Building for Production

**Frontend:**
```bash
cd frontend
npm run build
# Output in frontend/dist/
```

**Backend:**
```bash
cd backend
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## 📁 Project Structure

```
PESU_EC_CSE_D_P03_IT_infrastructure_management_software_Git-Souls/
├── src/                 # Source code
├── docs/               # Documentation
├── tests/              # Test files
├── .github/            # GitHub workflows and templates
├── README.md          # This file
└── ...
```

## 🛠️ Development Guidelines

### Branching Strategy
- `main`: Production-ready code
- `develop`: Development branch
- `feature/*`: Feature branches
- `bugfix/*`: Bug fix branches

### Commit Messages
Follow conventional commit format:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test-related changes

### Code Review Process
1. Create feature branch from `develop`
2. Make changes and commit
3. Create Pull Request to `develop`
4. Request review from team members
5. Merge after approval

## 📚 Documentation

- [API Documentation](docs/api.md)
- [User Guide](docs/user-guide.md)
- [Developer Guide](docs/developer-guide.md)

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📄 License

This project is developed for educational purposes as part of the PES University UE23CS341A curriculum.

---

**Course:** UE23CS341A  
**Institution:** PES University  
**Academic Year:** 2025  
**Semester:** 5th Sem
