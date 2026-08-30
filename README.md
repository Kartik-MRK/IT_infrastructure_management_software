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

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, TailwindCSS, Recharts, React Router v6 |
| **Backend** | Python 3, Flask, Flask-JWT-Extended, Flask-CORS |
| **Database** | Supabase (PostgreSQL 17) |
| **Auth** | Supabase Auth (email/password + OTP reset) |
| **Email** | Resend SMTP (`auth@mail.kartik-mrk.me`) |
| **ORM / DB Client** | `supabase-py` (backend), `@supabase/supabase-js` (frontend) |

---

## 📁 Project Structure

```
IT_infrastructure_management_software/
├── frontend/                  # React + Vite frontend
│   ├── src/
│   │   ├── pages/             # Login, Dashboard, Asset, Incident, UserManagement
│   │   ├── components/        # Shared UI components
│   │   └── lib/               # Supabase client setup
│   ├── .env.example           # Frontend environment variable template
│   ├── package.json
│   └── vite.config.js
│
├── backend/                   # Flask REST API
│   ├── app.py                 # Main application + all API routes
│   ├── simulate_metrics.py    # Script to simulate live asset metrics
│   ├── requirements.txt
│   └── .env.example           # Backend environment variable template
│
├── SQL/
│   └── schema.sql             # Complete database schema (single source of truth)
│
├── tests/                     # Project-level tests
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18.x and **npm** ≥ 9.x
- **Python** ≥ 3.10
- A **Supabase** project (or use the existing one — credentials in `.env`)
- Git

---

### 1. Clone the Repository

```bash
git clone https://github.com/pestechnology/PESU_EC_CSE_D_P03_IT_infrastructure_management_software_Git-Souls.git
cd PESU_EC_CSE_D_P03_IT_infrastructure_management_software_Git-Souls
```

---

### 2. Database Setup

The complete schema is in [`SQL/schema.sql`](SQL/schema.sql). If setting up a fresh Supabase project:

1. Open the Supabase dashboard → **SQL Editor**
2. Paste and run the contents of `SQL/schema.sql`

This creates all tables, indexes, views, functions, triggers, and RLS policies from scratch.

---

### 3. Email (SMTP) Setup

The project uses **[Resend](https://resend.com)** as the SMTP provider for all Supabase Auth emails (password reset OTPs, email verification). Without this configured you will hit Supabase's default 3 emails/hour free-tier cap.

**Step A — Configure custom SMTP in Supabase:**

1. Go to **Supabase Dashboard → Project Settings → Auth → [SMTP Settings](https://supabase.com/dashboard/project/odgxypyknkqlcasvomej/settings/auth)**
2. Enable **Custom SMTP** and fill in:

| Field | Value |
|---|---|
| **Host** | `smtp.resend.com` |
| **Port** | `465` |
| **Username** | `resend` |
| **Password** | *(Resend API key — see project secrets)* |
| **Sender Name** | `ITIMS Support` |
| **Sender Email** | `auth@mail.kartik-mrk.me` |

3. Click **Save**

> **Note:** The domain `mail.kartik-mrk.me` must be verified in your Resend account before emails will deliver.

**Step B — Configure the Password Reset email template:**

1. Go to **Supabase Dashboard → Auth → [Email Templates](https://supabase.com/dashboard/project/odgxypyknkqlcasvomej/auth/templates)**
2. Click **"Reset Password"**
3. Replace the **Message body (HTML)** with:

```html
<h2>Reset Your ITIMS Password</h2>
<p>You requested a password reset for your account.</p>
<p>Enter this 6-digit code in the app:</p>
<div style="font-size:48px;font-weight:bold;letter-spacing:14px;color:#4f46e5;
            text-align:center;padding:24px;background:#eef2ff;
            border-radius:12px;margin:20px 0;">
  {{ .Token }}
</div>
<p>This code expires in <strong>1 hour</strong>. Do not share it with anyone.</p>
<p>If you didn't request this, ignore this email.</p>
```

4. Click **Save**

**Step C — Configure the Confirm Signup email template:**

1. Go to **Supabase Dashboard → Auth → [Email Templates](https://supabase.com/dashboard/project/odgxypyknkqlcasvomej/auth/templates)**
2. Click **"Confirm signup"**
3. Replace the **Message body (HTML)** with:

```html
<h2>Confirm Your ITIMS Account</h2>
<p>Thanks for signing up for ITIMS!</p>
<p>Enter this 6-digit verification code in the app to activate your account:</p>
<div style="font-size:48px;font-weight:bold;letter-spacing:14px;color:#4f46e5;
            text-align:center;padding:24px;background:#eef2ff;
            border-radius:12px;margin:20px 0;">
  {{ .Token }}
</div>
<p>This code expires in <strong>1 hour</strong>. Do not share it with anyone.</p>
<p>If you didn't request this, ignore this email.</p>
```

4. Click **Save**

The `{{ .Token }}` placeholder is automatically replaced by Supabase with the 6-digit OTP code for both signup confirmation and password resets.

---

### 4. Backend Setup (Flask API)

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env and fill in your values (see below)
```

**`backend/.env` variables:**

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
JWT_SECRET_KEY=your_secret_key_here
FLASK_ENV=development
FLASK_DEBUG=True
```

**Run the backend:**

```bash
python app.py
```

The API will start at `http://localhost:5000`.

---

### 5. Frontend Setup (React + Vite)

```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env and fill in your values (see below)
```

**`frontend/.env` variables:**

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:5000/api
```

**Run the frontend dev server:**

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

### 6. Running Both Together

Open two terminals:

| Terminal | Command |
|---|---|
| Terminal 1 (Backend) | `cd backend && python app.py` |
| Terminal 2 (Frontend) | `cd frontend && npm run dev` |

Then open `http://localhost:5173` in your browser.

---

## 🔐 Login & Test Accounts

The application uses **Supabase Auth** with email/password authentication. There are three roles:

| Role | Permissions |
|---|---|
| `admin` | Full access — manage users, assets, incidents, metrics |
| `operator` | Create/edit own assets, update assigned incidents |
| `viewer` | Read-only access to assets and incidents |

### Available Test Users

The following accounts exist in the database and can be used for testing:

| Email | Password | Role | Name | Description |
|---|---|---|---|---|
| `guest.viewer@itims.local` | `GuestViewer123!` | **viewer** | Guest Viewer | **1-Click Bypass Button on Login Page** |
| `hgarg7234+se@gmail.com` | *(via OTP reset)* | **admin** | Hardik | Admin full access |
| `mavinkattakartik34@gmail.com` | *(via OTP reset)* | **operator** | John Wick | Operator edit access |
| `sewobis270@fergetic.com` | *(via OTP reset)* | **viewer** | Sewe Bis | Read-only access |

> **Quick Testing / Demo:** You can click the **"Bypass Login (Viewer Test Mode)"** button directly on the login page to enter the dashboard instantly as a read-only viewer without typing any credentials.
>
> **Password Management:** To reset any account password, use the **Forgot password?** link on the sign-in page to receive a **6-digit OTP** sent from `auth@mail.kartik-mrk.me`, then set a new password through the wizard.

---

## 📚 Key Features

- **Asset Management** — Track hardware, software, network, infrastructure, and peripheral assets
- **Real-time Metrics** — CPU, memory, disk, temperature, bandwidth, and peripheral health monitoring
- **Incident Tracking** — Create, assign, and resolve IT incidents with priority and severity levels
- **Role-Based Access Control** — Admin / Operator / Viewer roles enforced at the database level via RLS
- **Health Status Engine** — Automatic health computation trigger (`healthy` / `warning` / `critical`) on every metric update
- **Dashboard** — Overview charts and live asset health summaries via Recharts
- **OTP Sign-Up Verification** — 2-step registration: form validation (with password match verification) → 6-digit email OTP verification
- **OTP Password Reset** — 3-step wizard: email → 6-digit code → new password (no magic links)

---

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

---

## 🧪 Testing

```bash
# Backend tests
cd backend
python -m pytest tests/

# Frontend lint
cd frontend
npm run lint
```

---

## 📄 License

This project is developed for educational purposes as part of the PES University UE23CS341A curriculum.

---

**Course:** UE23CS341A  
**Institution:** PES University  
**Academic Year:** 2025  
**Semester:** 5th Sem
