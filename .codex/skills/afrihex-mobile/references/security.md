# Security

Mobile clients are inspectable. Anything shipped with the app can ultimately be discovered.

## Secrets

Never bundle:

- database credentials
- signing secrets
- service account credentials
- private API keys
- backend secrets

Allowed client-visible values:

- API base URL
- public analytics identifiers
- public feature configuration

Secrets belong on trusted backend infrastructure.

## Auth

- Store API tokens in `expo-secure-store`.
- Never store passwords.
- Never log tokens, passwords, OTPs, auth headers, or sensitive personal user data.
- Clear sensitive cached state on logout.
- Do not force logout from `user.expires_at`; it is subscription expiry.

## Environment

- Never treat `EXPO_PUBLIC_*` variables as secrets.
- Centralize environment configuration.
- Fail fast when required public configuration is missing.
- Use HTTPS endpoints in production.

## Permissions

- Request permissions only when needed.
- Request only permissions required for the feature.
- Handle granted, denied, permanently denied/restricted, and unavailable states.
- Provide a path to settings where appropriate.
- Do not repeatedly prompt users who have permanently denied permission.
