# Security Policy — OnchainWeb

## Repository Access Policy

### Mandatory Two-Factor Authentication (2FA / MFA)

**All repository access (read and write) requires two-factor authentication. No exceptions.**

Only accounts with 2FA enabled may:

- Clone or pull the repository
- Push commits or tags
- Open or review pull requests
- Access repository secrets or environment variables
- Manage releases, discussions, or repository settings

#### Accepted second factors

| Method | Accepted |
|---|---|
| Authenticator app (TOTP — Google Authenticator, Authy, etc.) | ✅ Yes |
| Hardware security key (WebAuthn / FIDO2 — YubiKey, etc.) | ✅ Yes |
| GitHub Mobile push approval | ✅ Yes |
| SMS one-time code | ⚠️ Permitted only as a fallback — must not be the sole second factor |
| Password-only (no second factor) | ❌ Not accepted |

#### How enforcement is applied

1. **GitHub Organisation setting** — "Require two-factor authentication" is enabled in
   _Organisation → Settings → Authentication security_.
   Any member who disables 2FA is automatically removed from the organisation.

2. **Branch protection rules** on `main` and `staging`:
   - Require pull request reviews before merge
   - Require status checks to pass (CI lint + test + build)
   - Do not allow bypassing the above rules — even for admins

3. **Personal Access Tokens (PATs)**:
   - Must use fine-grained PATs scoped to the minimum required permissions
   - Must belong to an account with 2FA already active
   - Must never be committed to source code or exposed in logs
   - Rotate every 90 days

4. **SSH keys**:
   - Must be registered to an account with 2FA already active
   - Ed25519 keys preferred; RSA keys must be ≥ 4096-bit
   - Compromised keys must be revoked immediately

5. **GitHub Actions / CI secrets**:
   - Store all secrets in _Repository → Settings → Secrets and variables → Actions_
   - Never echo secrets in workflow logs (`--quiet` flags where available)
   - Use `GITHUB_TOKEN` (auto-generated, short-lived) over long-lived PATs wherever possible

#### Revoking access

If a contributor account is found to have 2FA disabled:

1. Maintainer revokes their organisation membership immediately.
2. Contributor re-enables 2FA on their GitHub account.
3. Maintainer re-invites the contributor.
4. Contributor confirms 2FA is active before access is restored.

---

## Reporting a Vulnerability

If you discover a security vulnerability in this project:

1. **Do not open a public GitHub issue.**
2. Email the maintainer directly, or use
   [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability)
   if enabled for this repository.
3. Include a description of the vulnerability, steps to reproduce, and potential impact.
4. You will receive a response within **72 hours**.

---

## Supported Versions

| Version | Security fixes |
|---|---|
| `main` branch | ✅ Active |
| Feature branches | ❌ Best-effort only |
