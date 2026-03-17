
# Onchainweb

Welcome to the Onchainweb project, a cutting-edge web3 trading platform. This document provides a comprehensive overview of the project, setup instructions, and key development guidelines.

## Quick Start

To get started with the project, follow these steps:

1. **Clone the repository**
2. **Install dependencies**: `cd Onchainweb && npm install`
3. **Set up environment variables**: Create a `.env` file in the `Onchainweb` directory and add the required Firebase and WalletConnect credentials.
4. **Run the development server**: `cd Onchainweb && npm run dev`

For more detailed instructions, please refer to the `QUICK_START_GUIDE.md` document.

## Codespaces / Dev Container

The dev container installs all dependencies automatically on creation. The Vite dev server auto-starts as a background VS Code task when the workspace opens, so you do not need to run any command manually after the Codespace loads.

**Forwarded ports:**
- `5173` → Vite dev server (auto-opened in preview)
- `4173` → Vite preview server
- `4000` → Firebase Emulator UI
- `8080` → Firestore emulator
- `9099` → Auth emulator

**To start Firebase emulators** (optional — open a new terminal):
```bash
cd /workspaces/Dapp
npm run emulators
```

Or use the VS Code task **"Dev: start frontend + emulators"** to launch both in parallel.

## CI/CD & Deployment

### GitHub Actions Secrets

This repository uses GitHub Actions for continuous integration and deployment. To enable CI/CD workflows, configure the following secrets in **Settings → Secrets and variables → Actions**:

| Secret | Required | Description |
|--------|----------|-------------|
|  | CI build | Firebase Web API key |
|  | CI build | Firebase Auth domain |
|  | CI build | Firebase project ID |
|  | CI build | Firebase Storage bucket |
|  | CI build | Firebase Messaging sender ID |
|  | CI build | Firebase App ID |
|  | CI build | Firebase Measurement ID |
|  | CI build | WalletConnect Cloud project ID |
|  | Firebase deploy | JSON service account key |
|  | Firebase deploy | Alternative:  token |
|  | Cloudflare deploy | Optional: Cloudflare API token |

📚 **Complete Setup Guide**: See [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) for step-by-step instructions.

### Available Workflows

- **CI** (): Runs on every push and PR to main — builds, lints, tests, smoke-tests
- **Firebase Deploy** (): Deploys to Firebase Hosting on push to 
- **Cloudflare Deploy** (): Deploys Workers + Pages (requires )
- **Release** (): Creates a GitHub Release when a  tag is pushed
- **Health Check** (): Monitors production URLs every 6 hours

## AI Development Assistant

This project is supported by a new AI guidance system, designed to streamline development and ensure adherence to best practices. The AI assistant is programmed with our project's specific architectural patterns, including:

- **Firebase-first with `localStorage` fallback** for all data services.
- **Real-time data synchronization** using `onSnapshot` listeners instead of polling.
- **Standardized error handling** through the `formatApiError` utility.
- **Wallet integration** best practices for our 11 supported providers.

The AI can assist with a wide range of tasks, such as refactoring components, implementing new features, and answering questions about the codebase. All developers are encouraged to leverage the AI to accelerate their work and maintain code quality.

To learn more about the AI's capabilities and how to interact with it, please refer to the internal documentation provided by our team.

## Key Resources

- **Quick Start**: `QUICK_START_GUIDE.md`
- **CI/CD Secrets Setup**: `SECRETS.md`
- **Backend Architecture**: `BACKEND_REPLACEMENT.md`
- **Real-time Data**: `REALTIME_DATA_ARCHITECTURE.md`
- **Deployment**: `VERCEL_DEPLOYMENT_GUIDE.md`
- **Environment Variables**: `docs/ENVIRONMENT_VARIABLES.md`

### Admin & Management
- **Admin Features Review**: `ADMIN_FEATURES_REVIEW.md` - Comprehensive review of admin features and login functionality
- **Admin Review Summary**: `ADMIN_REVIEW_SUMMARY.md` - Executive summary and quick reference
- **Admin Setup**: `docs/admin/ADMIN_SETUP_GUIDE.md` - Complete admin setup guide
- **Master Account**: `MASTER_ACCOUNT_LOGIN_FIX.md` - Login fix documentation

By following these guidelines and leveraging the new AI assistant, we can ensure a consistent and high-quality development process.
