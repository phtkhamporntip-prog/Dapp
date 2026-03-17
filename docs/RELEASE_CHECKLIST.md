# 🎉 Public Release Checklist

Final checklist for making OnchainWeb publicly available.

> **Stack**: React 18 + Vite (frontend) · Firebase Auth/Firestore/Hosting (backend) · Cloudflare Workers/Pages (optional CDN/API layer)

---

## ✅ Pre-Launch Checklist

### 1. Environment & Secrets

- [ ] Copy `Onchainweb/.env.example` → `Onchainweb/.env` and fill in all values
- [ ] Configure GitHub repository secrets (Settings → Secrets and variables → Actions):

  **Required for CI build:**
  | Secret | Description |
  |--------|-------------|
  | `VITE_FIREBASE_API_KEY` | Firebase Web API key |
  | `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
  | `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
  | `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
  | `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging sender ID |
  | `VITE_FIREBASE_APP_ID` | Firebase App ID |
  | `VITE_FIREBASE_MEASUREMENT_ID` | Firebase Measurement ID (optional) |
  | `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project ID |

  **Required for Firebase Hosting deploy:**
  | Secret | Description |
  |--------|-------------|
  | `FIREBASE_SERVICE_ACCOUNT` | JSON service account key (recommended) |
  | `FIREBASE_TOKEN` | CI token from `firebase login:ci` (alternative) |

  **Optional repository variable:**
  | Variable | Description |
  |----------|-------------|
  | `FIREBASE_PROJECT_ID` | Firebase project ID (used in deploy workflow) |

  **Required for Cloudflare deploy (optional):**
  | Secret | Description |
  |--------|-------------|
  | `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Pages/Workers permissions |

### 2. Firebase Console Setup

- [ ] Create Firebase project at https://console.firebase.google.com
- [ ] Enable **Authentication** (Email/Password provider)
- [ ] Enable **Firestore Database** (start in production mode)
- [ ] Enable **Realtime Database** (if using chat)
- [ ] Enable **Hosting**
- [ ] Deploy Firestore rules: `firebase deploy --only firestore:rules`
- [ ] Deploy Firestore indexes: `firebase deploy --only firestore:indexes`
- [ ] Deploy Database rules: `firebase deploy --only database`
- [ ] Create admin accounts in Firebase Auth (email format: `username@admin.onchainweb.app`)
- [ ] Add admin emails to `VITE_ADMIN_ALLOWLIST` in your environment

### 3. Build & Deploy

- [ ] Verify `npm run build` succeeds locally: `cd Onchainweb && npm run build`
- [ ] Output is in `Onchainweb/dist/` ← matches `firebase.json` `"public"` setting
- [ ] CI workflow passes on the `main` branch
- [ ] Firebase deploy workflow succeeds
- [ ] Site is live at your Firebase Hosting URL

### 4. Repository Settings

- [ ] Make repository public (Settings → Danger Zone → Change visibility)
- [ ] Enable Issues (Settings → Features → Issues)
- [ ] Add repository description and topics (`web3`, `react`, `firebase`, `defi`, `trading`)
- [ ] Verify no `.env` files or secrets are committed (`.gitignore` covers them)

### 5. Create GitHub Release

Run the release workflow by pushing a version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The `.github/workflows/release.yml` workflow will:
1. Build the production bundle
2. Create a GitHub Release with release notes
3. Attach the `dist` archive as a release asset

---

## 🚀 Setup Guide

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/<your-org>/<your-repo>.git
cd Dapp

# 2. Install dependencies
npm install                  # root (firebase-tools devDependency)
cd Onchainweb && npm install # frontend

# 3. Set up environment
cp Onchainweb/.env.example Onchainweb/.env
# Edit Onchainweb/.env and fill in your Firebase and WalletConnect credentials

# 4. Start development server
npm run dev                  # from repo root, starts Vite at http://localhost:5173

# 5. (Optional) Start Firebase emulators
npm run emulators            # from repo root, starts emulator UI at http://localhost:4000
```

### Codespaces / Dev Container

1. Open the repository in GitHub Codespaces
2. `postCreateCommand` will automatically install all dependencies
3. VS Code will auto-start the Vite dev server (background task) when the workspace opens
4. To start Firebase emulators manually, open a terminal and run:
   ```bash
   cd /workspaces/<your-repo-name>
   npm run emulators
   ```
5. Forwarded ports:
   - `5173` → Vite dev server (auto-opened in preview)
   - `4000` → Firebase Emulator UI
   - `8080` → Firestore emulator
   - `9099` → Auth emulator

### Production Build

```bash
cd Onchainweb
npm run build:production     # outputs to Onchainweb/dist/
```

### Deploy

**Firebase Hosting** (primary):
```bash
firebase deploy --only hosting
```

**Cloudflare Pages** (optional CDN):
```bash
cd Onchainweb && npm run deploy:cloudflare
```

**Cloudflare Workers** (optional API layer):
```bash
wrangler deploy              # from repo root
```

---

## 🔐 Secrets Reference

Never commit secrets. Use these methods:

- **Local dev**: `Onchainweb/.env` (gitignored)
- **CI/CD**: GitHub repository secrets
- **Cloudflare Workers**: `wrangler secret put <NAME>`
- **Firebase**: Firebase Console → Project Settings → Service Accounts

### Generating FIREBASE_SERVICE_ACCOUNT

1. Go to [Firebase Console](https://console.firebase.google.com) → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Add the **entire JSON content** as the `FIREBASE_SERVICE_ACCOUNT` secret in GitHub

### Generating FIREBASE_TOKEN (alternative)

```bash
npm install -g firebase-tools
firebase login:ci
# Copy the token output and add as FIREBASE_TOKEN secret
```

---

## 🛠️ Troubleshooting

### Build fails (no env vars)
The build works without env vars — Firebase will be disabled and the app falls back to `localStorage`. For production, set all `VITE_FIREBASE_*` secrets.

### Firebase deploy skipped in CI
Add `FIREBASE_SERVICE_ACCOUNT` or `FIREBASE_TOKEN` to repository secrets. See the section above.

### Codespaces disconnects on start
The dev container uses VS Code Tasks for auto-start instead of a blocking `postStartCommand`. If the Vite task does not auto-start, run `npm run dev` in the terminal.

### Admin login not working
1. Create user in Firebase Console → Authentication → Users
2. Use email format: `username@admin.onchainweb.app`
3. Set `VITE_ADMIN_ALLOWLIST=your-email@admin.onchainweb.app` in `.env`
4. Set `VITE_ENABLE_ADMIN=true`

### Emulators not starting
Ensure root dependencies are installed: `npm install` from repo root (installs `firebase-tools`). Then: `npm run emulators`

---

## 📋 Post-Launch Monitoring

- Health checks run every 6 hours via `.github/workflows/health-check.yml`
- Security audit runs weekly via `.github/workflows/security-audit.yml`
- Set `FRONTEND_URL` and `BACKEND_URL` secrets to enable URL monitoring

---

**Ready to Launch?** ✅ Complete all items above and push a `v*` tag to trigger the release workflow.
