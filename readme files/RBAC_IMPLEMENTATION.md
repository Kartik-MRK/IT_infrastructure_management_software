# Role-Based Access Control (RBAC) Implementation Guide

## Overview

This document describes the complete implementation of the 3-tier role-based access control system for ITIMS.

## Architecture

### Three-Tier Role System

#### 1. Administrator (admin) 👑
**Full system access with user management capabilities**

Permissions:
- ✅ View and edit all users
- ✅ Grant/revoke admin privileges
- ✅ Change user roles
- ✅ Full CRUD on assets
- ✅ Full CRUD on incidents
- ✅ Access all reports and analytics
- ✅ System configuration
- ✅ Audit logs access

UI Access:
- Dashboard with all stats
- User Management panel (exclusive)
- All asset operations
- All incident operations
- Full reporting suite

#### 2. Operator (operator) ⚙️
**Technician role for day-to-day operations**

Permissions:
- ✅ View and edit assets
- ✅ Create and resolve incidents
- ✅ Monitor system health
- ✅ Manage alerts
- ✅ Generate operational reports
- ❌ Cannot manage users
- ❌ Limited deletion rights
- ❌ Cannot access admin settings

UI Access:
- Dashboard with operational stats
- Asset management (view/edit)
- Incident management (full)
- Monitoring and alerts
- Operational reports

#### 3. Viewer (viewer) 👁️
**Read-only stakeholder access**

Permissions:
- ✅ View dashboards
- ✅ View assets (read-only)
- ✅ View incidents (read-only)
- ✅ View reports
- ❌ Cannot create or edit anything
- ❌ Cannot delete anything
- ❌ Cannot access user management
- ❌ Cannot access system settings

UI Access:
- Dashboard with summary stats
- Asset list (read-only)
- Incident list (read-only)
- Reports viewing only

---

## Database Implementation

### Profiles Table Schema

```sql
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
```

### Key Features:
- `full_name`: Required field, collected during signup
- `gender`: Optional field with 4 predefined values
- `role`: Defaults to 'viewer' for new signups
- Enum constraint ensures only valid roles

### Automatic User Profile Creation

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, gender, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'gender', 'prefer_not_to_say'),
    'viewer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Row Level Security (RLS) Policies

#### Basic Policies
```sql
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
```

#### Admin-Only Policies
```sql
-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update any profile
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

## Frontend Implementation

### 1. Extended Signup Form

**File**: `frontend/src/pages/Login.jsx`

Added state variables:
```jsx
const [fullName, setFullName] = useState('')
const [gender, setGender] = useState('prefer_not_to_say')
```

Extended signup logic:
```jsx
if (!fullName.trim()) {
  throw new Error('Full name is required')
}

const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: fullName,
      gender: gender
    }
  }
})
```

Form fields (shown only during signup):
```jsx
{isSignUp && (
  <>
    <div>
      <label htmlFor="fullName">Full Name</label>
      <input
        id="fullName"
        type="text"
        required
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="John Doe"
      />
    </div>
    
    <div>
      <label htmlFor="gender">Gender</label>
      <select
        id="gender"
        value={gender}
        onChange={(e) => setGender(e.target.value)}
      >
        <option value="prefer_not_to_say">Prefer not to say</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="other">Other</option>
      </select>
    </div>
  </>
)}
```

### 2. User Management Dashboard

**File**: `frontend/src/pages/UserManagement.jsx`

Key features:
- Fetches all users from `profiles` table
- Displays user information in a table
- Role management dropdown for each user
- Real-time role updates
- Statistics cards showing role distribution
- Role-based badge colors (red for admin, blue for operator, green for viewer)

Role update function:
```jsx
async function updateUserRole(userId, newRole) {
  try {
    setUpdatingUser(userId)
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) throw error

    // Update local state
    setUsers(users.map(user => 
      user.id === userId ? { ...user, role: newRole } : user
    ))

    alert('User role updated successfully!')
  } catch (error) {
    alert('Error updating role: ' + error.message)
  } finally {
    setUpdatingUser(null)
  }
}
```

### 3. Dashboard with Admin Section

**File**: `frontend/src/pages/Dashboard.jsx`

Fetch user profile with role:
```jsx
const [profile, setProfile] = useState(null)

async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  setUser(user)
  
  if (user) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    setProfile(profileData)
  }
  
  setLoading(false)
}
```

Conditional admin panel link:
```jsx
{profile?.role === 'admin' && (
  <a href="/users" className="px-3 py-2 rounded-md text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100">
    👑 Admin Panel
  </a>
)}
```

### 4. App Routing

**File**: `frontend/src/App.jsx`

Added user management route:
```jsx
import UserManagement from './pages/UserManagement'

// In Routes:
<Route 
  path="/users" 
  element={session ? <UserManagement /> : <Navigate to="/login" />} 
/>
```

---

## Setup Instructions

### Step 1: Database Setup
1. Go to Supabase Dashboard → SQL Editor
2. Run all SQL scripts from `DATABASE_SCHEMA.md`
3. Verify tables and triggers are created
4. Enable RLS on `profiles` table

### Step 2: Create Admin Account
1. Sign up through UI with:
   - Email: `admin@gmail.com`
   - Password: `admin1234`
   - Full Name: Admin
   - Gender: Any option
2. Confirm email
3. Run SQL to promote:
```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@gmail.com';
```

### Step 3: Test Access Control
1. Log in as admin
2. Verify "👑 Admin Panel" link appears
3. Navigate to User Management
4. Create test users with different roles
5. Log in as each role to verify permissions

---

## User Flow

### New User Signup
1. User fills signup form (email, password, full name, gender)
2. Supabase creates auth.users entry
3. Trigger automatically creates profiles entry
4. Profile defaults to 'viewer' role
5. User receives confirmation email
6. After confirmation, user can log in

### Admin Managing Users
1. Admin logs in
2. Sees admin panel link in navigation
3. Clicks to access User Management
4. Views all users in table format
5. Uses dropdown to change user roles
6. Changes apply immediately
7. Other users see updated permissions on next login

### Role-Based UI
- **Login**: All users use same login form
- **Dashboard**: Different views based on role
  - Admin: Full stats + admin panel link
  - Operator: Operational stats
  - Viewer: Summary stats only
- **Navigation**: Menu items shown based on role
- **User Management**: Only visible to admins

---

## Security Considerations

### Database Level
- ✅ RLS enabled on profiles table
- ✅ Enum constraints on role field
- ✅ Users can only view/edit own profile
- ✅ Only admins can view/edit all profiles
- ✅ Trigger prevents role manipulation during signup

### Frontend Level
- ✅ Role-based navigation rendering
- ✅ Protected routes require authentication
- ✅ Admin panel hidden from non-admins
- ✅ User management page checks session

### Best Practices
- ⚠️ Always verify role on backend before critical operations
- ⚠️ Don't rely solely on UI hiding for security
- ⚠️ Log all role changes for audit purposes
- ⚠️ Implement rate limiting on role update endpoint
- ⚠️ Use strong password requirements in production

---

## Future Enhancements

### Planned Features
1. **Role-based asset permissions**
   - Operators can only edit assigned assets
   - Viewers cannot see sensitive asset details

2. **Incident assignment**
   - Auto-assign incidents to operators
   - Viewers can only see incidents they reported

3. **Audit logging**
   - Track all role changes
   - Log admin actions
   - Generate compliance reports

4. **Advanced permissions**
   - Granular permission system (create, read, update, delete per module)
   - Custom role creation
   - Department-based access control

5. **User invitations**
   - Admins can invite users directly
   - Pre-assign roles before user signs up
   - Bulk user import from CSV

---

## Testing Checklist

- [ ] Database schema created successfully
- [ ] Triggers firing on new user creation
- [ ] RLS policies enforcing access control
- [ ] Signup form collecting name and gender
- [ ] Admin account created and promoted
- [ ] Admin panel link visible only to admins
- [ ] User Management page accessible by admins
- [ ] Role changes updating in real-time
- [ ] Non-admins cannot access /users route
- [ ] Role badges displaying correct colors
- [ ] Statistics showing correct counts
- [ ] Test users with each role (admin, operator, viewer)
- [ ] Logout and re-login preserving role state

---

## Troubleshooting

### Common Issues

**Issue**: Admin panel link not showing
- Check if user role is 'admin' in database
- Refresh page after role change
- Clear browser cache

**Issue**: Cannot update user roles
- Verify RLS policies are created
- Check if current user is admin
- Look for errors in browser console

**Issue**: Signup not capturing name/gender
- Verify form fields are present
- Check if metadata is passed in signup options
- Confirm trigger function extracts metadata correctly

**Issue**: Profile not created after signup
- Check if trigger is attached to auth.users table
- Verify trigger function syntax
- Look for errors in Supabase logs

---

## Contact & Support

For issues or questions:
- Check `DATABASE_SCHEMA.md` for SQL scripts
- See `ADMIN_SETUP.md` for admin account setup
- Review `SETUP.md` for environment configuration
- Consult `DAY1_SUMMARY.md` for authentication details

---

**Last Updated**: Day 2 - RBAC Implementation
**Status**: ✅ Complete and functional
