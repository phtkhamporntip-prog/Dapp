# 🔧 Fix Master Admin Login Issues

**Status**: Configuration verified ✅

- ✅ VITE_ENABLE_ADMIN=true
- ✅ VITE_ADMIN_ALLOWLIST=phtkhamporntip@gmail.com,admin@gmail.com
- ✅ VITE_FIREBASE_PROJECT_ID=onchainweb-dapp
- ✅ Master-admin route registered

---

## ⚠️ Common Issues & Solutions

### Issue 1: "Master account not found in Firebase"

**Error Message**: `Admin account not found in Firebase`

**Root Cause**: The phtkhamporntip@gmail.com account doesn't exist in Firebase Console

**Fix**:

1. Go to Firebase Console: https://console.firebase.google.com/u/0/project/onchainweb-dapp

2. Click **Build** → **Authentication**

3. Click **Users** tab

4. Click **+ Add User** button

5. **Email**: `phtkhamporntip@gmail.com`

6. **Password**: Create a strong password (14+ characters recommended)
   - example: `SnipeMaster2026!SuperSecure`

7. Click **Add user**

8. **Save the password somewhere safe!**

---

### Issue 2: "This email is not authorized for admin access"

**Error Message**: `This email is not authorized for admin access`

**Root Cause**: Email is not in VITE_ADMIN_ALLOWLIST

**Fix**:

1. Open `/workspaces/Dapp/Onchainweb/.env`

2. Find this line:

   ```
   VITE_ADMIN_ALLOWLIST=phtkhamporntip@gmail.com,admin@gmail.com
   ```

3. **Make sure it includes**: `phtkhamporntip@gmail.com`

4. **Restart dev server** (see below)

---

### Issue 3: "Page won't load or shows blank screen"

**Symptoms**:

- Page is blank
- Nothing loads
- Loading spinner spins forever

**Root Cause**: Dev server not restarted after .env changes

**Fix**:

1. Stop the dev server (press **Ctrl+C** or **Cmd+C** in terminal)

2. Clear Next.js cache:

   ```bash
   cd /workspaces/Dapp/Onchainweb
   rm -rf dist node_modules/.vite
   ```

3. **Restart dev server**:

   ```bash
   npm run dev
   ```

4. Wait for compilation to complete (look for: ✓ built in XXs)

5. Open browser: http://localhost:5173/master-admin

6. **Hard refresh** (Ctrl+Shift+R or Cmd+Shift+R)

---

### Issue 4: "Incorrect password" error

**Error Message**: `Incorrect password`

**Root Cause**: Password typed incorrectly or doesn't match Firebase

**Fix**:

1. **Go to Firebase Console**:
   - https://console.firebase.google.com/u/0/project/onchainweb-dapp

2. **Delete the old account** (if it exists):
   - Authentication → Users
   - Click on phtkhamporntip@gmail.com
   - Click **Delete user** (⋮ menu)

3. **Create new account**:
   - Click **+ Add User**
   - Email: `phtkhamporntip@gmail.com`
   - Password: **Write down the exact password** - copy/paste from password manager
   - Click **Add user**

4. **Try login again** with exact password

---

### Issue 5: "Firebase not initialized" or blank form

**Error Message**:

- `Firebase not initialized`
- `Firebase authentication is not configured`
- Login form doesn't appear

**Root Cause**: Firebase environment variables not set properly

**Fix**:

1. Open `/workspaces/Dapp/Onchainweb/.env`

2. **Check these lines exist** (copy exact values):

   ```env
   VITE_FIREBASE_API_KEY=AIzaSyA56Pq_WcE6TehQDayLTZ0ibCHCwZkUUlw
   VITE_FIREBASE_AUTH_DOMAIN=onchainweb-dapp.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://onchainweb-dapp-default-rtdb.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=onchainweb-dapp
   VITE_FIREBASE_STORAGE_BUCKET=onchainweb-dapp.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=1032172642498
   VITE_FIREBASE_APP_ID=1:1032172642498:web:your-app-id
   VITE_FIREBASE_MEASUREMENT_ID=G-2XBP804Q8Z
   VITE_ENABLE_ADMIN=true
   VITE_ADMIN_ALLOWLIST=phtkhamporntip@gmail.com,admin@gmail.com
   ```

3. If any are missing or different, update them

4. **Restart dev server**:
   ```bash
   npm run dev
   ```

---

### Issue 6: Browser console has red errors

**How to check**:

1. Press **F12** to open Developer Tools

2. Click **Console** tab

3. Look for red error messages (not orange warnings)

**Common errors**:

#### "ReferenceError: auth is not defined"

- Means Firebase didn't initialize
- Fix: Check all VITE*FIREBASE*\* vars in .env
- Restart dev server

#### "TypeError: firebaseSignIn is not a function"

- Means import is broken
- Fix: Check /src/lib/firebase.js exists and exports correctly
- Restart dev server and hard refresh

#### "auth/user-not-found"

- Means phtkhamporntip@gmail.com doesn't exist in Firebase
- Fix: Go to Firebase Console → Authentication → Create the user

---

## 🚀 Full Step-by-Step Fix (Do this if nothing else works)

### Step 1: Verify Firebase Account

```bash
cd /workspaces/Dapp
# Open this in browser:
# https://console.firebase.google.com/u/0/project/onchainweb-dapp
```

**In Firebase Console**:

- Build → Authentication → Users
- Click **+ Add User**
- Email: `phtkhamporntip@gmail.com`
- Password: `TestPassword123!` (use a simple password for testing)
- Click **Add user**
- Wait for it to appear in the Users list ✓

### Step 2: Verify Environment Variables

```bash
cd /workspaces/Dapp/Onchainweb
cat .env | grep VITE
```

**Should show** (9 lines):

```
VITE_FIREBASE_API_KEY=AIzaSyA56Pq_WcE6TehQDayLTZ0ibCHCwZkUUlw
VITE_FIREBASE_AUTH_DOMAIN=onchainweb-dapp.firebaseapp.com
...
VITE_ENABLE_ADMIN=true
VITE_ADMIN_ALLOWLIST=phtkhamporntip@gmail.com,admin@gmail.com
```

### Step 3: Clear Cache & Restart Dev Server

```bash
cd /workspaces/Snipe-/Onchainweb
pkill -f "npm run dev" || true  # Kill any existing dev server
rm -rf dist node_modules/.vite dist/.vite_metadata.json 2>/dev/null || true
npm run dev
```

**Wait for**:

```
✓ built in 17.04s
Local:     http://localhost:5173/
```

### Step 4: Open Master Admin

In browser:

```
http://localhost:5173/master-admin
```

### Step 5: Test Login

**Email**: `phtkhamporntip@gmail.com`
**Password**: `TestPassword123!` (what you created in Step 1)

Click **Login**

---

## ✅ Success Indicators

✓ Login form shows (not blank)
✓ "Master Admin Portal" heading visible
✓ Email and Password fields visible
✓ Can type in fields
✓ Login button is clickable
✓ After login, dashboard loads
✓ No red errors in console (F12)

---

## 🆘 Still Not Working?

Run this diagnostic command:

```bash
cd /workspaces/Dapp
echo "=== Firebase Config ==="
cat Onchainweb/.env | grep VITE_FIREBASE | head -1
echo "=== Admin Enabled ==="
cat Onchainweb/.env | grep VITE_ENABLE_ADMIN
echo "=== Allowlist ==="
cat Onchainweb/.env | grep VITE_ADMIN_ALLOWLIST
echo "=== Route Check ==="
grep -c "master-admin" Onchainweb/src/main.jsx
echo "=== Component Check ==="
test -f Onchainweb/src/components/MasterAdminDashboard.jsx && echo "✓ Component exists" || echo "❌ Component missing"
```

Then share the output in your response, I'll help debug!

---

## 📝 Checklist

Before trying to login, confirm:

- [ ] Firebase Authentication is enabled (Build → Authentication)
- [ ] Email/Password provider is enabled (Authentication → Sign-in method)
- [ ] phtkhamporntip@gmail.com account exists (Authentication → Users)
- [ ] VITE_ENABLE_ADMIN=true in .env
- [ ] phtkhamporntip@gmail.com is in VITE_ADMIN_ALLOWLIST
- [ ] Dev server restarted after .env changes
- [ ] Browser hard refreshed (Ctrl+Shift+R or Cmd+Shift+R)
- [ ] No red errors in browser console (F12)

---

## 📞 Quick Command to Fix Everything

```bash
# 1. Kill any existing dev server
pkill -f "npm run dev" 2>/dev/null || true

# 2. Navigate to project
cd /workspaces/Dapp/Onchainweb

# 3. Clear caches
rm -rf dist node_modules/.vite .vite 2>/dev/null || true

# 4. Restart dev server (will compile)
npm run dev

# In another terminal, test:
# Open: http://localhost:5173/master-admin
# Email: phtkhamporntip@gmail.com
# Password: (whatever you created in Firebase Console)
```

---

**Created**: February 6, 2026
**Last Updated**: Auto-generated
**Status**: Ready to use
