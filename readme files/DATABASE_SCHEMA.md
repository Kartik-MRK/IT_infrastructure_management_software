# Supabase Database Schema

This document contains the SQL scripts to set up your Supabase database for the ITIMS application.

## 📚 Table of Contents
1. [Initial Setup](#initial-setup)
2. [Users Table (Extended)](#users-table-extended)
3. [Future Tables](#future-tables)
4. [Row Level Security (RLS)](#row-level-security-rls)

---

## Initial Setup

### Note on Authentication
Supabase automatically creates an `auth.users` table when you enable authentication. You don't need to create this manually. However, you can extend it with a custom `public.profiles` table.

---

## Users Table (Extended)

Create a `profiles` table to store additional user information beyond what Supabase Auth provides.

### SQL Script

Run this in **Supabase SQL Editor** (Dashboard → SQL Editor → New Query):

```sql
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'operator', 'viewer')),
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
  INSERT INTO public.profiles (id, email, full_name, gender, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'prefer_not_to_say'),
    'viewer'  -- Default role for new signups
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

-- Profiles are viewable by everyone but only updatable by the user
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update any profile (for role management)
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### Create Admin User

After setting up the schema, create the admin account:

```sql
-- Note: First sign up with admin@gmail.com through the UI, then run this:
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@gmail.com';
```

### Table Structure

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, references auth.users |
| `email` | TEXT | User's email (unique) |
| `full_name` | TEXT | User's full name |
| `role` | TEXT | User role: 'admin', 'user', or 'viewer' |
| `avatar_url` | TEXT | Profile picture URL |
| `created_at` | TIMESTAMP | Account creation time |
| `updated_at` | TIMESTAMP | Last update time |

---

## Future Tables

These tables will be needed for upcoming features. **Don't create them yet** - they're planned for Day 2+.

### Assets Table (Day 2)

```sql
-- This is for reference only - create this on Day 2
CREATE TABLE public.assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_name TEXT NOT NULL,
  asset_type TEXT CHECK (asset_type IN ('hardware', 'software', 'network', 'other')),
  description TEXT,
  serial_number TEXT,
  purchase_date DATE,
  warranty_expiry DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  assigned_to UUID REFERENCES public.profiles(id),
  location TEXT,
  cost DECIMAL(10, 2),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Incidents Table (Day 3)

```sql
-- This is for reference only - create this on Day 3
CREATE TABLE public.incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  asset_id UUID REFERENCES public.assets(id),
  reported_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Row Level Security (RLS)

RLS policies ensure users can only access data they're authorized to see.

### Example RLS Policies (For Future Use)

```sql
-- Assets: Users can view all, but only admins can modify
CREATE POLICY "Anyone can view assets"
  ON public.assets FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert assets"
  ON public.assets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update assets"
  ON public.assets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Incidents: Users can view their own, admins can view all
CREATE POLICY "Users can view own incidents"
  ON public.incidents FOR SELECT
  USING (
    reported_by = auth.uid() OR assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

## Setup Instructions

### Step 1: Run Initial Schema

1. Go to your Supabase project
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the **Users Table (Extended)** SQL script above
5. Paste it into the editor
6. Click **Run** (or press Ctrl+Enter)
7. Verify success message appears

### Step 2: Verify Tables Created

1. Click **Table Editor** in the left sidebar
2. You should see `profiles` table listed
3. Click on `profiles` to view its structure

### Step 3: Test User Creation

1. Go back to your ITIMS app (http://localhost:5173)
2. Sign up with a new test account
3. Return to Supabase → Table Editor → profiles
4. You should see a new row with the user's data
5. The trigger automatically created the profile!

---

## Database Diagram (Current State)

```
┌─────────────────┐
│   auth.users    │  (Managed by Supabase Auth)
│─────────────────│
│ id (PK)         │
│ email           │
│ encrypted_pass  │
│ ...             │
└────────┬────────┘
         │
         │ 1:1
         │
         ▼
┌─────────────────┐
│  profiles       │  (Custom table)
│─────────────────│
│ id (PK, FK)     │
│ email           │
│ full_name       │
│ role            │
│ avatar_url      │
│ created_at      │
│ updated_at      │
└─────────────────┘
```

## Future Database Diagram (After Day 2-3)

```
┌─────────────────┐
│   auth.users    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐           ┌─────────────────┐
│  profiles       │◄──────────┤    assets       │
└────────┬────────┘  assigned_to└────────┬────────┘
         │                              │
         │                              │
         │ reported_by/assigned_to      │ asset_id
         │                              │
         ▼                              ▼
┌─────────────────────────────────────────────┐
│              incidents                      │
└─────────────────────────────────────────────┘
```

---

## Useful Queries

### Check Current Profiles
```sql
SELECT * FROM public.profiles;
```

### Count Users by Role
```sql
SELECT role, COUNT(*) as count
FROM public.profiles
GROUP BY role;
```

### Get User with Email
```sql
SELECT *
FROM public.profiles
WHERE email = 'user@example.com';
```

### Update User Role (Admin Only)
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@example.com';
```

---

## 🔒 Security Best Practices

1. ✅ **Always use RLS**: Never disable RLS on tables with sensitive data
2. ✅ **Service Role Key**: Keep it secret, never expose in frontend
3. ✅ **Anon Key**: Safe for frontend, but always use RLS policies
4. ✅ **Test Policies**: Verify users can't access unauthorized data
5. ✅ **Audit Logs**: Supabase provides logs in Dashboard → Logs

---

## 📞 Need Help?

- **Supabase Docs**: https://supabase.com/docs
- **SQL Tutorial**: https://supabase.com/docs/guides/database
- **RLS Guide**: https://supabase.com/docs/guides/auth/row-level-security

---

**Schema Version:** v1.0 (Day 1)  
**Last Updated:** Day 1 Completion  
**Next Update:** Day 2 (Asset Management)
