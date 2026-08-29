# ITIMS — Setup & Getting Started

This combined guide helps you get the IT Infrastructure Management System (ITIMS) up and running and provides quick troubleshooting and next steps.

##  What this guide covers

- Quick prerequisites and setup for frontend and backend
- Supabase configuration and recommended SQL to initialize profiles
- How to run the app locally (frontend + backend)
- Troubleshooting tips and useful commands

---

##  Prerequisites Checklist

Before starting, make sure you have:
- Node.js installed (v18+)
- Python installed (v3.10+)
- Git installed
- A Supabase account

---

##  Step-by-Step Setup

### Step 1 — Create a Supabase project

1. Go to https://supabase.com and sign in
2. Click **New Project** and fill the required fields
3. Wait a couple minutes for the project to be provisioned

### Step 2 — Collect Supabase credentials

In your Supabase project go to Settings  API and copy:

- `Project URL` (example: `https://xxxxx.supabase.co`)
- `anon public` key (for frontend)
- `service_role` key (for backend — keep secret)

### Optional: Run recommended SQL to create `profiles`

Before creating users, run this SQL in Supabase SQL Editor to create a `profiles` table, triggers and RLS policies:

```sql
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to profiles table
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create profile automatically on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles are viewable by everyone
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Users can update own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
```

---

### Step 3 — Setup frontend

1. Open a terminal and clone (if you haven't already) and change into the frontend folder:

```powershell
git clone <your-repo-url>
cd PESU_EC_CSE_D_P03_IT_infrastructure_management_software_Git-Souls/frontend
```

2. Install dependencies and create `.env`:

```powershell
npm install
copy .env.example .env   # Windows
# OR
cp .env.example .env     # Mac/Linux
```

3. Edit `frontend/.env` and set the Supabase values:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your_anon_public_key
```

4. Start the frontend dev server:

```powershell
npm run dev
```

Frontend should now be running at: http://localhost:5173

---

### Step 4 — Setup backend

Open a new terminal and run:

```powershell
cd PESU_EC_CSE_D_P03_IT_infrastructure_management_software_Git-Souls/backend
python -m venv venv
.\venv\Scripts\activate    # Windows PowerShell
pip install -r requirements.txt
copy .env.example .env
# Edit backend/.env with your Supabase service role and JWT secret
```

Edit `backend/.env`:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...your_service_role_key
JWT_SECRET_KEY=change_this_to_random_string_in_production
FLASK_ENV=development
FLASK_DEBUG=True
```

Generate a secure JWT secret (optional):

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Start the backend server:

```powershell
python app.py
```

Backend API should be available at: http://localhost:5000

---

### Step 5 — Test the full flow

1. Open http://localhost:5173
2. Use the Sign up flow to create a test account (email + password)
3. Confirm the account via the email link (or disable confirmations in Supabase during development)
4. Log in and verify the Dashboard and features

---

##  Troubleshooting

- **Frontend not loading or connection errors**: ensure `npm run dev` is running and `frontend/.env` has correct values.
- **Can't sign up/login**: verify backend (Flask) is running on port `5000`, check `backend/.env` uses the `service_role` key for server-side calls.
- **Email confirmation not received**: check spam folder or disable email confirmations in Supabase Auth settings (development only).
- **CORS errors**: ensure frontend runs on port `5173` and backend `5000`, and that backend CORS is configured correctly in `backend/app.py`.

If you need more detail, check the repository docs (`README.md`, `backend/README.md`) or the project's support contacts.

---

##  Quick Reference — Commands

- Start frontend:

```powershell
cd frontend
npm run dev
```

- Start backend:

```powershell
cd backend
.\venv\Scripts\activate
python app.py
```

- Health endpoints and URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- API Health: `http://localhost:5000/api/health`

---

##  Current status / Notes

- The app should be ready to use after completing steps above.
- Environment files to check: `frontend/.env`, `backend/.env`.
- For development, consider disabling email confirmation in Supabase to speed testing.

---

##  Need Help?

- Check `README.md` and other docs in the `readme files/` folder.
- Contact the Git Souls team members listed in project docs if needed.

**Happy coding!**
