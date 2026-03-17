# 🚀 Firebase Extensions & Complete Deployment Guide

## Phase 1: Firebase Console Prerequisites (15 min)

### Step 1.1: Activate Firebase Services

Visit [Firebase Console](https://console.firebase.google.com/u/0/project/onchainweb-dapp) and enable:

#### ✅ **Firestore Database**

1. Go to **Build** → **Firestore Database**
2. Click **Create Database**
3. Choose **Production mode** (for live app)
4. Set location: **United States (us-central1)**
5. Click **Create**

#### ✅ **Authentication**

1. Go to **Build** → **Authentication**
2. Click **Get Started**
3. Click **Email/Password**
4. Enable **Email/Password** option
5. Click **Save**

#### ✅ **Cloud Storage** (for profile images, optional but recommended)

1. Go to **Build** → **Storage**
2. Click **Get Started**
3. Accept default bucket name
4. Choose **Start in Production mode**
5. Click **Done**

#### ✅ **Realtime Database** (optional, if using real-time features)

1. Go to **Build** → **Realtime Database**
2. Click **Create Database**
3. Choose location: **United States (us)**
4. Click **Start in production mode**
5. Click **Enable**

---

## Phase 2: Firebase Extensions Setup (30 min)

Firebase Extensions automate common backend tasks. Recommended extensions for Snipe:

### Option A: Essential Extensions (Recommended)

#### 1. **Cloud Tasks Queue Extension** (for scheduled tasks)

**Purpose**: Schedule deposit verifications, cleanup jobs, raid event timers

**Steps**:

1. Go to **Build** → **Extensions** → **Browse Extensions**
2. Search: **Cloud Tasks Queue**
3. Click **Install**
4. Confirm project: **onchainweb-dapp**
5. Click **Install extension**
6. Wait for completion (usually 2-3 min)

**Configuration**:

- Collection path: `tasks` (keeps scheduled operations)
- Function name: `processTask` (auto-generated)

#### 2. **Stripe Extension** (if accepting crypto/fiat payments)

**Purpose**: Handle deposits, withdrawals, payment processing

**Steps**:

1. Go to **Build** → **Extensions** → **Browse Extensions**
2. Search: **Stripe**
3. Click **Stripe Payments Extension** by Firebase
4. Click **Install**
5. Confirm project and click **Install extension**

**Configuration**:

- Stripe API Key: (get from https://dashboard.stripe.com/apikeys)
- Collection: `charges`
- Webhook secret: (generated after install)

#### 3. **Run a PubSub Function**

**Purpose**: Process async tasks without blocking API

**Steps**:

1. Go to **Build** → **Extensions** → **Browse Extensions**
2. Search: **Run a PubSub Function**
3. Click **Install**
4. Confirm project and install

**Configuration**:

- Topic name: `snipe-tasks`
- Function name: `handleTask`

### Option B: Authentication & Email Extensions

#### 4. **Automatically Send Emails**

**Purpose**: Send password resets, deposit confirmations, raid alerts

**Steps**:

1. Go to **Build** → **Extensions** → **Browse Extensions**
2. Search: **Automatically Send Emails**
3. Click **Install**
4. Confirm project and install

**Configuration**:

- Mail provider: **SMTP** (or Mailjet if you have account)
- Trigger collection: `mail`
- SMTP Server: smtp.gmail.com (Google)
- SMTP User: your-email@gmail.com
- SMTP Password: [App password from Google Account]

**To get Gmail App Password**:

1. Go to https://myaccount.google.com/security
2. Enable 2-factor authentication
3. Go to **App passwords**
4. Select **Mail** and **Windows Computer**
5. Copy the 16-character password
6. Use in extension configuration

#### 5. **User Authentication with Blocking Functions**

**Purpose**: Custom validation when users sign up

**Steps** (if you want user onboarding validation):

1. Go to **Build** → **Extensions** → **Browse Extensions**
2. Search: **User Authentication with Blocking Functions**
3. Click **Install**
4. Confirm and install

---

## Phase 3: Recommended Extension Combinations

### Scenario A: Full-Featured Setup (Recommended for Snipe)

Install these in order:

1. ✅ **Cloud Tasks Queue** - Process deposits, trades,
   raids
2. ✅ **Automatically Send Emails** - Notifications
3. ✅ **Stripe Extension** - Handle payments
4. ✅ **Run a PubSub Function** - Async processing

**Time to install**: ~15 minutes

### Scenario B: Lightweight Setup

Install just:

1. ✅ **Cloud Tasks Queue** - Basic scheduling
2. ✅ **Automatically Send Emails** - Notifications

**Time to install**: ~5 minutes

### Scenario C: Start Minimal (Now, Add Later)

- Just enable basic services first
- Add extensions after initial deployment
- You can always install extensions later without disrupting app

---

## Phase 4: Create Admin Accounts (5 min)

### Create Master Admin Account

1. Go to **Build** → **Authentication** → **Users**
2. Click **Add User**
3. Enter:
   - Email: `phtkhamporntip@gmail.com`
   - Password: (create strong password)
4. Click **Add User**

### Create Regular Admin Account

1. Click **Add User** again
2. Enter:
   - Email: `admin@gmail.com`
   - Password: (create strong password)
3. Click **Add User**

**Store these credentials securely!** (Use password manager)

---

## Phase 5: Deploy Firestore Rules (5 min)

Run this command to deploy security rules to your Firebase project:

```bash
cd /workspaces/Snipe-
firebase deploy --only firestore:rules,firestore:indexes --project onchainweb-dapp
```

This deploys:

- ✅ Security rules (who can read/write what)
- ✅ Database indexes (for fast queries)

Expected output:

```
✔ deployed firestore.rules
✔ deployed firestore.indexes
```

---

## Phase 6: Deploy Application (Choose One)

### Option A: Vercel (Recommended - Fastest)

**Prerequisites**: Vercel account (free at vercel.com)

**Steps**:

```bash
cd /workspaces/Snipe-/Onchainweb

# Install Vercel CLI
npm install -g vercel

# Deploy to production
vercel --prod
```

**During deployment**:

- Confirm project name (or link existing Vercel project)
- Framework: **Vite** (auto-detected)
- Output directory: **dist**
- Build command: **npm run build** (keep default)

**Production URL**: https://your-project-name.vercel.app

---

### Option B: Firebase Hosting (Firebase-Native)

**Steps**:

```bash
cd /workspaces/Snipe-

# Build first
cd Onchainweb && npm run build && cd ..

# Deploy to Firebase Hosting
firebase deploy --only hosting --project onchainweb-dapp
```

**Production URL**: https://onchainweb-dapp.web.app

---

### Option C: Netlify (Alternative)

**Prerequisites**: Netlify account (free at netlify.com)

**Steps**:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
cd /workspaces/Snipe-/Onchainweb
netlify deploy --prod
```

---

## Phase 7: Verify Deployment (10 min)

### Step 7.1: Test Main App

After deployment, open your production URL:

```
https://your-production-url.vercel.app (or .web.app)
```

Verify:

- ✅ Page loads without errors
- ✅ No red errors in browser console (F12 → Console)
- ✅ Firebase logo appears (app is connected)

### Step 7.2: Test Master Admin Login

1. Go to: `https://your-production-url/master-admin`
2. Login with: **phtkhamporntip@gmail.com** / **your-password**
3. Verify:
   - ✅ Dashboard loads
   - ✅ Can see user management
   - ✅ Can see deposits pending
   - ✅ Can see all trades
   - ✅ Real-time updates work (check browser console for no errors)

### Step 7.3: Test Regular Admin Login

1. Go to: `https://your-production-url/admin`
2. Login with: **admin@gmail.com** / **your-password**
3. Verify:
   - ✅ Dashboard loads
   - ✅ Can see limited permissions panel
   - ✅ Features work correctly

### Step 7.4: Test Main Features

In the main app (`/` route):

- ✅ Wallet connects (if available)
- ✅ Trading view displays
- ✅ Chat loads (if enabled)
- ✅ User profile accessible
- ✅ No console errors

### Step 7.5: Check Firestore Data

1. Go to **Firebase Console** → **Firestore Database**
2. Verify collections exist:
   - ✅ `users` collection created
   - ✅ `trades` collection created
   - ✅ `chatMessages` collection (if used)
   - ✅ `notifications` collection created

---

## Phase 8: Configure Email Extension (If Installed)

If you installed **Automatically Send Emails** extension:

### Step 8.1: Test Email Function

In Firebase Console, create a test email:

1. Go to **Firestore Database**
2. Click **+ Start collection**
3. Collection ID: `mail`
4. Auto ID for document
5. Add fields:

```
Field: to
Type: string
Value: your-email@gmail.com

Field: message
Type: map
Value: {
  subject: "Test Email from Snipe",
  text: "This is a test email",
  html: "<h1>Test Email</h1><p>From Snipe App</p>"
}
```

1. Click **Save**

Wait 10-30 seconds. Check your email for the test message.

**If you don't receive the email**:

- Check Firebase Functions logs (Extensions → Email Extension → Logs)
- Verify SMTP credentials if using Gmail
- Check spam folder
- Enable less secure apps if using Gmail: https://myaccount.google.com/lesssecureapps

---

## Phase 9: Monitor Extension Status

Go to **Build** → **Extensions** to check installed extensions:

- ✅ Green checkmarks = Running successfully
- ⚠️ Yellow warnings = May need attention
- ❌ Red errors = Requires fix immediately

---

## Troubleshooting

### Problem: "Firestore is not initialized"

**Solution**:

1. Go to **Build** → **Firestore Database**
2. Click **Create Database**
3. Choose **Production mode**
4. Set location: **us-central1** (match your project)

### Problem: "Authentication failed"

**Solution**:

1. Go to **Build** → **Authentication**
2. Click **Get Started**
3. Enable **Email/Password** provider
4. Make sure your admin accounts exist

### Problem: "Extensions installation fails"

**Solution**:

1. Check your Firebase plan (Extensions need Blaze plan)
2. Upgrade to **Blaze** (pay-as-you-go): https://firebase.google.com/pricing
3. Retry extension installation

### Problem: "Email not sending"

**Solution**:

1. Verify SMTP credentials in extension settings
2. Check Firebase Functions logs for errors
3. Create a test document in `mail` collection
4. Check spam folder
5. Try with a different email address

---

## Complete Deployment Checklist

- [ ] Phase 1: Firebase services activated (Firestore, Auth, Storage)
- [ ] Phase 2: Install recommended extensions (optional but recommended)
- [ ] Phase 3: Admin accounts created (phtkhamporntip@gmail.com, admin@gmail.com)
- [ ] Phase 4: Deploy Firestore rules (`firebase deploy --only firestore:rules`)
- [ ] Phase 5: Deploy app (Vercel/Firebase/Netlify)
- [ ] Phase 6: Test main app loads without errors
- [ ] Phase 7: Test master admin login works
- [ ] Phase 8: Test regular admin login works
- [ ] Phase 9: Verify all features work (trading, chat, deposits, etc.)
- [ ] Phase 10: Check browser console has no red errors
- [ ] Phase 11: Monitor Firebase Functions/Extensions logs

---

## Quick Reference: Key URLs

| Service              | URL                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------ |
| Firebase Console     | https://console.firebase.google.com/u/0/project/onchainweb-dapp                      |
| Extensions Dashboard | https://console.firebase.google.com/u/0/project/onchainweb-dapp/extensions           |
| Authentication       | https://console.firebase.google.com/u/0/project/onchainweb-dapp/authentication/users |
| Firestore Database   | https://console.firebase.google.com/u/0/project/onchainweb-dapp/firestore            |
| Cloud Functions Logs | https://console.firebase.google.com/u/0/project/onchainweb-dapp/functions            |
| Your Production App  | https://your-url.vercel.app or https://onchainweb-dapp.web.app                       |
| Master Admin Login   | https://your-url/master-admin                                                        |
| Regular Admin Login  | https://your-url/admin                                                               |

---

## Support

**For Firebase Issues**:

- Firebase Documentation: https://firebase.google.com/docs
- Extensions Documentation: https://firebase.google.com/docs/extensions

**For Snipe App Issues**:

- Check [DEPLOYMENT.md](./DEPLOYMENT.md)
- Check [BACKEND_REPLACEMENT.md](./BACKEND_REPLACEMENT.md)
- Review browser console logs (F12)
- Check Firebase Functions logs

---

**Next Steps**:

1. Complete Firebase Console setup ↑ (Phases 1-3)
2. Run: `firebase deploy --only firestore:rules --project onchainweb-dapp`
3. Deploy app to production (Phase 5)
4. Verify everything works (Phase 6+)
