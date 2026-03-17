#!/bin/bash
set -e

cd /workspaces/Dapp

# Remove any artifact files
rm -f onchainweb@1.0.0 vite

# Check status
echo "=== Git Status ==="
git status

# Commit changes
echo ""
echo "=== Committing Changes ==="
git add -A
git commit -m "chore: Update dependencies and deployment scripts

- Update @web3modal/wagmi to 5.0.11 for compatibility
- Add firebase-tools 15.10.1 to root dependencies for Cloud Functions
- Downgrade vite to 8.0.0 and wrangler to 4.75.0 for stability
- Adjust logo sizing in index.css (36px/30px for responsive layouts)
- Fix walletConnect import to use correct config export path
- Enhance Vercel deployment script with better error handling and scope validation
- Add Vercel project name validation (lowercase, 100 char limit, no ---)
- Normalize route values in deployment configuration
- Use npm ci when package-lock.json exists for deterministic builds"

# Show the commit
echo ""
echo "=== Commit Created ==="
git log --oneline -1

# Push to main
echo ""
echo "=== Pushing to main ==="
git push origin main

echo ""
echo "✅ Success: Changes committed and pushed to main"
