# Deployment Guide - Snipe Platform

This guide covers deploying the Snipe platform to production using Cloudflare Pages and Workers.

---

## 🚀 Quick Deployment (5 Minutes)

### Prerequisites

1. ✅ Node.js 18+ installed
2. ✅ Firebase project configured
3. ✅ Cloudflare account (free tier works)
4. ✅ GitHub repository access

---

## 📋 Step-by-Step Deployment

### 1. Configure Environment Variables

#### A. Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project → Settings → Project settings
3. Scroll to "Your apps" → Web app
4. Copy configuration values

#### B. WalletConnect

1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com)
2. Create a project
3. Copy Project ID

#### C. Cloudflare Credentials

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Account → API Tokens
3. Copy Account ID and create API token

#### D. Update `.env` File

```bash
cd Onchainweb
cp .env.example .env

# Edit .env with your credentials
nano .env  # or use your preferred editor
```

**Required variables:**

```bash
# Firebase
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=onchainweb-dapp.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=onchainweb-dapp
VITE_FIREBASE_STORAGE_BUCKET=onchainweb-dapp.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1032172642498
VITE_FIREBASE_APP_ID=1:123:web:abc
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXX

# WalletConnect
VITE_WALLETCONNECT_PROJECT_ID=abc123...

# Live support backend (Cloudflare Worker)
VITE_CLOUDFLARE_WORKER_URL=https://your-support-api.workers.dev

# Cloudflare (for deployment only)
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token

# Admin controls (private release)
VITE_ENABLE_ADMIN=false
VITE_ADMIN_ROUTE=/internal-admin
VITE_MASTER_ADMIN_ROUTE=/internal-master
VITE_ADMIN_ALLOWLIST=master@yourdomain.com
```

---

### 2. Deploy Firebase Security Rules

```bash
# From project root
firebase deploy --only firestore:rules

# Deploy indexes
firebase deploy --only firestore:indexes
```

---

### 3. Deploy to Cloudflare

#### Option A: Automated Deployment Script

```bash
# From project root
chmod +x deploy.sh
./deploy.sh
```

The script will:

1. ✅ Check environment variables
2. ✅ Install dependencies
3. ✅ Build production bundle
4. ✅ Deploy Cloudflare Workers
5. ✅ Deploy to Cloudflare Pages

#### Option B: Manual Deployment

**Step 1: Build Frontend**

```bash
cd Onchainweb
npm install
npm run build:production
```

**Step 2: Deploy Workers**

```bash
cd ..
wrangler deploy
```

**Step 3: Deploy Pages**

```bash
wrangler pages deploy Onchainweb/dist --project-name=onchainweb
```

---

### 4. Set Up Cloudflare KV & R2

#### A. Create KV Namespace

```bash
wrangler kv:namespace create "CACHE"
```

Copy the namespace ID to `wrangler.toml`

#### B. Create R2 Bucket

```bash
wrangler r2 bucket create onchainweb
```

#### C. Update wrangler.toml

The file should already have the correct configuration with the provided credentials:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "488840361a874877b2b54506b15f746a"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "onchainweb"
```

---

### 5. Configure Custom Domain (Optional)

#### A. Add Domain to Cloudflare Pages

1. Go to Cloudflare Dashboard → Pages
2. Select your project → Custom domains
3. Add your domain (e.g., `app.yourdomain.com`)

#### B. Update DNS

Cloudflare will automatically add the required DNS records.

#### C. Enable HTTPS

HTTPS is automatically enabled on Cloudflare Pages.

---

### 6. Verify Deployment

#### A. Check Frontend

```bash
curl https://onchainweb.pages.dev/
# Should return HTML
```

#### B. Check Workers

```bash
curl https://snipe-onchainweb.onchainweb.workers.dev/health
# Should return: {"status":"healthy","service":"snipe-onchainweb","version":"1.0.0"}
```

#### C. Test Features

1. ✅ Wallet connection
2. ✅ User registration
3. ✅ Real-time updates
4. ✅ Live support chat stream
5. ✅ Trading functions

### 7. Private Admin Release Process

To keep admin controls private in public production:

1. Keep `VITE_ENABLE_ADMIN=false` in normal public deploys.
2. For controlled admin release, enable admin only in protected environment variables.
3. Use private route slugs, not `/admin` and `/master-admin`.
4. Keep `VITE_ADMIN_ALLOWLIST` restricted to authorized emails.
5. Keep `VITE_ENABLE_ADMIN_WALLET_AUTODETECT=false` unless explicitly required.
6. Verify admin pages are not linked in public navigation.
7. After admin tasks, disable admin again and redeploy public build.

---

## 🔄 Continuous Deployment (CI/CD)

### GitHub Actions Workflow

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically deploys on push to `main` branch.

**Setup:**

1. Add secrets to GitHub repository:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
2. Push to main branch
3. Deployment happens automatically

**Workflow features:**

- ✅ Runs tests before deployment
- ✅ Builds production bundle
- ✅ Deploys Workers and Pages
- ✅ Notifies on completion

---

## 🛠️ Troubleshooting

### Build Fails

**Problem**: `npm run build` fails
**Solution**:

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Firestore Rules Error

**Problem**: `Permission denied` errors
**Solution**:

```bash
# Redeploy rules
firebase deploy --only firestore:rules
```

### Worker Not Found

**Problem**: `404` on worker endpoints
**Solution**:

```bash
# Verify worker is deployed
wrangler deployments list

# Redeploy if needed
wrangler deploy
```

### Environment Variables Not Working

**Problem**: App can't connect to Firebase
**Solution**:

1. Verify `.env` file exists in `Onchainweb/` directory
2. Check all `VITE_` prefixed variables
3. Restart dev server after changes

---

## 📊 Monitoring & Analytics

### Cloudflare Analytics

- Go to Dashboard → Analytics
- View requests, bandwidth, errors
- Set up alerts for downtime

### Firebase Console

- Monitor database usage
- Track authentication
- View real-time connections

### Performance Monitoring

```bash
# Run Lighthouse audit
npm run lighthouse

# Check bundle size
npm run build:production
ls -lh Onchainweb/dist
```

---

## 🔐 Security Checklist

Before deploying to production:

- [ ] All `.env` files in `.gitignore`
- [ ] Firebase Security Rules deployed
- [ ] No API keys in frontend code
- [ ] HTTPS enabled everywhere
- [ ] Admin allowlist configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Security headers set

---

## 💰 Cost Optimization

### Reduce Firebase Costs

1. Enable caching with Cloudflare KV
2. Use batch operations
3. Optimize query patterns
4. Set up billing alerts

### Reduce Cloudflare Costs

1. Use KV for frequently accessed data
2. Set appropriate cache TTLs
3. Compress responses
4. Use R2 for large files

---

## 🔄 Rollback Procedure

If deployment fails:

### Rollback Pages

```bash
# List deployments
wrangler pages deployments list --project-name=onchainweb

# Rollback to previous
wrangler pages deployment rollback <deployment-id>
```

### Rollback Workers

```bash
# Deploy previous version
git checkout <previous-commit>
wrangler deploy
```

### Rollback Firestore Rules

```bash
# Restore from Firebase Console
# Console → Firestore → Rules → History
```

---

## 📚 Additional Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers)
- [Firebase Hosting Docs](https://firebase.google.com/docs/hosting)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler)

---

## 🆘 Support

If you encounter issues:

1. Check [KNOWN_ISSUES.md](KNOWN_ISSUES.md)
2. Search [GitHub Issues](https://github.com/ddefi0175-netizen/Snipe-/issues)
3. Open a new issue with deployment logs

---

**Deployment complete!** Your app is now live! 🚀
